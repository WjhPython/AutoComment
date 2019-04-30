const { EventEmitter } = require('events');
const ds = require('./datasource');
const fs = require('fs');
const path = require('path');
const config = require('./config');

module.exports = function( Director ) {
    const _Director = Director;  
    this.event = new EventEmitter();
    this.temp = {};
    this.extrat = ( ) => {
        let director = this;
        return new Promise( async (resolve, reject) => {
            try {
                let frame = await this.task.stack.top();
                if( frame.extractorType ) {
                    let Extrator = _Director.__extratorsMap.get( frame.extractorType );
                    if( Extrator ) {
                        let extrator = new Extrator();
                        let results = await extrator.__go( frame, director );
                        resolve( results );
                    }
                }
                else {
                    for( let [ extractorType, Extrator ] of _Director.__extratorsMap ) {
                        let extrator = new Extrator();
                        let results = await extrator.__go( frame, director );
                        if( results && results.length ) {
                            resolve( results )
                            return;
                        }
                    }
                }
            } catch (error) {
                console.error(error);
                reject(error);
            } finally {
                resolve( );
            }
        } );
    }
    this.__go = async ( ) => {
        try {
            if( await this.task.stack.size() == 0 ) {
                if( await this.task.getStatus() == ds.STATUS_RUNNING ) {
                    let info = await this.task.info();
                    await this.task.stack.push({
                        'type':'extractor',
                        'url':info.starturl
                    });
                }
                else {
                    this.event.emit( 'finish', this.taskId );
                    return;
                }
            }
            this.event.emit( 'start', this.taskId );
            while( true ) {
                this.temp = {};
                let results;
                try {
                    if( await this.task.getStatus() == ds.STATUS_DELETING ) {
                        break;
                    }
                    results = await this.extrat( );
                    if( await this.task.getStatus() == ds.STATUS_DELETING ) {
                        break;
                    }
                } catch ( error ) {
                    try {
                        if( await this.task.getStatus() == ds.STATUS_DELETING ) {
                            break;
                        }
                        //错误重试
                        let frame = await this.task.stack.top();
                        if( frame.__retryCount == undefined )
                            frame.__retryCount = await ds.global.get('retry') || 0;
                        if( frame.__retryCount > 0 ) {
                            frame.__retryCount--;
                            results = [ frame ];
                        }
                        else if( frame.__retryCount == 0 ) {
                            await ds.errors.insert( this.taskId, frame.url, frame, JSON.stringify(error) );
                        }
                    } catch (error) {
                        console.error( error );
                    }
                }
                await this.task.stack.pop();
                if( results ) {
                    for( let result of results ) {
                        if( result.type == 'result') {
                            if( this.check && !this.check( result.result ) ) {
                                try {
                                    await ds.errors.insert( this.taskId, result.result.sourceUrl, result, JSON.stringify(new Error('check error')) );
                                } catch (error) {
                                    console.error( error );
                                }
                            } else {
                                this.event.emit( 'process', this.taskId, { result: result.result } );
                            }
                        }
                        else if( result.type == 'extractor') {
                            await this.task.stack.push( result);
                        }
                    }
                }
                if( await this.task.stack.size() == 0 ) {
                    this.event.emit( 'finish', this.taskId );
                    break;
                }
            }
        } catch (error) {
            console.log( error);
            this.event.emit( 'error', this.taskId, error );
        } finally {
            if( this.event ) {
                this.event.emit( 'stoped', this.taskId );
            }
        }
    };
    //绑定任务
    this.take = ( taskId ) => {
        this.taskId = taskId;
        this.task = ds.task.get( taskId);
    };

    this.taskId = '';
    this.task = null;
}