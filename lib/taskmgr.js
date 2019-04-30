const util = require('util');
const assert = require('assert');
const { EventEmitter } = require('events');
const ds = require('./datasource');
const dm = require('./directorsmgr');
const firewall = require( './firewall');
const request = require('request-promise');
const zlib = require('zlib');

module.exports = new function( ) {
    this.event = new EventEmitter();
    let taskMgr = this;
    function uploadResult( taskId ){
        return new Promise( async (resolve, reject) => { 
            try {
                let task = await ds.task.get( taskId);
                let uploadUrl = await ds.global.get('uploadUrl');
                if( !uploadUrl)
                    throw 'upload url empty';
                let count = 1;
                while( true) {
                    let offset = await task.getUploadOffset();
                    let results = await ds.results.getList( taskId, offset, count );
                    if( !results || results.length == 0)
                        break;
                    for( let i = 0; i < results.length; i++ ) {
                        results[i] = JSON.parse(results[i].result );
                        {
                            console.log(taskId + ' ' + 'download pic');
                            let retry = 2;
                            while( retry ) {
                                try {
                                    //下载缩略图，重试两次
                                    let picData = await request.get( results[i].pic, {
                                        encoding: null, timeout: 60000
                                    } );
                                    if( picData ) {
                                        results[i].picData = picData.toString('base64');
                                        break;
                                    }
                                } catch (error) {
                                    console.error(error);
                                }
                                retry--;
                            }
                            console.log(taskId + ' ' + 'download pic end');
                        }
                        {
                            console.log(taskId + ' ' + 'download head');
                            let retry = 2;
                            while( retry ) {
                                try {
                                    //下载头像，重试两次
                                    let faceData = await request.get( results[i].face, {
                                        encoding: null, timeout: 60000
                                    } );
                                    if( faceData ) {
                                        results[i].faceData = faceData.toString('base64');
                                        break;
                                    }
                                } catch (error) {
                                    console.error(error);
                                }
                                retry--;
                            }
                            console.log(taskId + ' ' + 'download head end');
                        }
                    }
                    let body = JSON.stringify(results);
                    if( body) {
                        //压缩数据发送
                        body = zlib.gzipSync(body,{level:zlib.constants.Z_BEST_COMPRESSION});
                        console.log('upload');
                        let content = await request.post( uploadUrl , { body: body } );
                        console.log('upload end');
                        if( content == 'ok') {
                            await task.updateUploadOffset( offset + results.length );
                            continue;
                        }
                    }
                    reject();
                    return;
                }
                resolve();
            } catch (error) {
                reject( error);
            }
            reject();
        } );
    }

    function goDirector( taskId ) {
        return new Promise( async (resolve, reject) => { 
            try {
                let director = await dm.build( taskId );
                if( director ) {
                    director.event.on( 'finish', ( taskId ) => {
                        director.event = null;
                        setImmediate( async ()=>{
                            let task = ds.task.get( taskId);
                            try {
                                console.log( 'task: ' + taskId + ' finish');
                                await task.updateStatus( ds.STATUS_UPLOADING );
                                await uploadResult( taskId );
                                await task.updateStatus( ds.STATUS_FINISH );
                            } catch (error) {
                                await task.updateStatus( ds.STATUS_UPLOAD_FAILED );
                                console.log( error );
                            }
                            await goTask();
                        });
                    });
                    director.event.on( 'process', async ( taskId, info ) => {
                        setImmediate( async ()=>{
                            console.log( 'task: ' + taskId + ' process ' + info.result.sourceUrl);
                            try {
//                                if( new Date().getTime() > 1513267200000 )
//                                    return;
                                await ds.results.insert( taskId, [info.result]);
                            } catch (error) {
                                console.log(error);
                            }
                        });
                    });
                    director.event.on( 'stoped', ( taskId ) => {
                        director.event = null;
                        setImmediate( async ()=>{
                            try {
                                let task = ds.task.get( taskId);
                                if( task) {
                                    await task.updateStatus( ds.STATUS_STOPED);
                                }
                                console.log( 'task stoped: ' + taskId );
                            } catch (error) {
                                
                            }
                            await goTask();
                        });
                    });
                    director.event.on( 'error', ( taskId, error ) => {
                        director.event = null;
                        setImmediate( async ()=>{
                            try {
                                let task = ds.task.get( taskId);
                                if( task) {
                                    await task.updateStatus( ds.STATUS_FAILED);
                                }
                                console.log( 'task: ' + taskId + ' error ' + error );
                            } catch (error) {
                            }

                            await goTask();
                        });
                    });
                    director.event.on( 'start', ( taskId ) => {
                        setImmediate( async ()=>{
                            console.log( 'task: ' + taskId + ' start');
                        });
                    });
                    director.__go( taskId );
                }
            } catch (error) {
                //task错误信息保存
                console.log(error);
            }
            resolve();
        } );
    }
    //启动任务
    function loadTask ( ) {
        return new Promise( async (resolve, reject) => {
            try {
                let ids = await ds.task.getRunningIds();
                if( ids && ids.length > 0) {
                    for( let id of ids ) {
                        await goDirector( id);
                    }
                }
            } catch (error) {
                reject(error);
            }
            resolve();
        });
    }
    //开始任务
    function goTask ( ) { 
        return new Promise( async (resolve, reject) => {
            try {
                await firewall.lock();
                let concurrent = await ds.global.get('concurrent');
                if( !concurrent)
                    concurrent = 1;
                let ids = await ds.task.getRunningIds() || [];
                if( ids.length < concurrent) {
                    for( let i = 0; i < concurrent - ids.length; i++ ) {
                        let taskId = await ds.task.fetch();
                        if( !taskId)
                            break;
                        await goDirector( taskId);
                    }
                }
            } catch (error) {
                reject(error);
            } finally {
                firewall.unlock();
                resolve();
            }
        });
    }
    //添加任务
    this.add = ( url, config ) => {
        return new Promise( async (resolve, reject) => { 
            if( !config)
                config = {};
            try {
                await ds.task.new( url, config);
                await goTask( );
            } catch (error) {
                reject(error);
            }
            resolve();
        });
    }
    this.stopAll = ( ) => {
        return new Promise( async (resolve, reject) => { 
            try {
                await ds.global.set( { 'stopAll' : true } );
                event.emit( 'stopAll');
            } catch (error) {
                reject(error);
            }
            resolve();
        });
    }
    this.load = ( ) => {
        return new Promise( async (resolve, reject) => { 
            try {
                //初始化状态变量
                await ds.global.set( 'stop' , false );
                //加载之前正在运行的任务
                await loadTask( );
                await goTask( );
            } catch (error) {
                reject(error);
            }
            resolve( );
        });
    }
    this.reupload = ( id ) => {
        return new Promise( async (resolve, reject) => { 
            try {
                let task = ds.task.get( id);
                await task.updateStatus( ds.STATUS_UPLOADING );
                await goDirector( id);
            } catch (error) {
                reject(error);
            }
            resolve( );
        });
    }
    this.go = ( ) => {
        return new Promise( async (resolve, reject) => { 
            try {
                await goTask( );
            } catch (error) {
                reject(error);
            }
            resolve( );
        });
    }
    this.remove = ( taskId ) => {
        return new Promise( async (resolve, reject) => { 
            try {
                let task = ds.task.get( taskId);
                if( await task.getStatus() == ds.STATUS_RUNNING ) {
                    await task.updateStatus( ds.STATUS_DELETING );
                    await new Promise( async (resolve) => {
                        let count = 60;
                        async function checkFinish() {
                            try {
                                if( await task.getStatus() != ds.STATUS_DELETING || count <= 0) {
                                    resolve();
                                    return;
                                }
                            } catch (error) {
                                console.error(error);
                                resolve();
                                return;
                            }
                            count--;
                            setTimeout( checkFinish, 1000 );
                        }
                        setTimeout( checkFinish, 1000 );
                    });
                }
                await task.remove( );
            } catch (error) {
                console.log(error);
                reject(error);
            }
            resolve( );
        });
    }
};