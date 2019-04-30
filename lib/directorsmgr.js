const ds = require('./datasource');
const fs = require('fs');
const path = require('path');


const DIRECTORS_PATH = './directors/';
const MAIN_NAME = 'main.js';

module.exports = new function( ) {
    this.directorMap = new Map();
    this.domainMap = new Map();

    this.init = ( ) => {
        let basePath = path.join( __dirname, DIRECTORS_PATH );
        let dirList = fs.readdirSync( path.join( __dirname, DIRECTORS_PATH ) );
        for( let item of dirList ) {
            let pluginPath = path.join( basePath, item );
            let pluginMainFile = path.join( pluginPath, MAIN_NAME );

            if( !fs.existsSync( pluginMainFile ))
                continue;
            //初始化插件
            let Director = require( pluginMainFile );
            Director.__path = pluginPath;
            Director.__extratorsMap = new Map();

            //存储指导器
            this.directorMap.set( Director.Constant.id, {
                name: Director.Constant.name,
                comment: Director.Constant.comment,
                Type: Director.Type
            });
            console.info( '加载采集器：');
            console.info( JSON.stringify( this.directorMap.get( Director.Constant.id)));

            Director.Constant.domains.forEach( ( domain ) => {
                this.domainMap.set( domain, Director.Constant.id);
            }, this);

            let dirList = fs.readdirSync( Director.__path );
            for( let item of dirList ) {
                if( !item.startsWith('extractor') )
                    continue;
                let extratorPath = path.join( Director.__path, item );
                let Extrator = require( extratorPath);
                Director.__extratorsMap.set( Extrator.Constant.type, Extrator.Class);
            }
        }
        console.log( '总共加载采集器数量：' + this.directorMap.size );
    }
    this.build = ( taskId ) => {
            return new Promise( async (resolve, reject) => { 
            try {
                let task = ds.task.get( taskId);
                let taskInfo = await task.info();
                let url = taskInfo.starturl;
                if( !url) 
                    throw new Error('');
                let matchRet = url.match(/\w+:\/\/([^\/]*)/i);
                if( !matchRet || matchRet.length != 2)
                    throw new Error('');
                let domain = matchRet[1];
                if( !domain)
                    throw new Error('');

                let id = this.domainMap.get(domain);
                while( !id ) {
                    matchRet = domain.match(/.*?\.(.*)/i);
                    if( !matchRet || matchRet.length != 2)
                        break;
                    domain = matchRet[1];
                    id = this.domainMap.get(domain);
                    if( id)
                        break;
                }
                if( !id)
                    throw new Error('can\'t match url');

                let directorItem = this.directorMap.get(id);
                let Director = directorItem.Type;
                let director = new Director();
                director.take( taskId);
                resolve( director );
            } catch ( error) {
                console.log( error );
                reject( error);
            }
        });
    }
};