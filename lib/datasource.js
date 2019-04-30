const Datastore = require('nedb');
const sqlite = require('sqlite');
const config = require('./config');
const CallQueue = require('./callqueue');
const uuid = require('uuid/v4');

module.exports = new function () {
    this.STATUS_READY = 0;
    this.STATUS_RUNNING = 1;
    this.STATUS_UPLOADING = 2;
    this.STATUS_FINISH = 3;
    this.STATUS_STOPING = 4;
    this.STATUS_STOPED = 5;
    this.STATUS_FAILED = 6;
    this.STATUS_DELETING = 7;
    this.STATUS_UPLOAD_FAILED = 8;
    
    let ds = this;
    let db;
    let cq = new CallQueue();

    this.getStatusName = ( status ) => {
        switch( status ) {
        case this.STATUS_READY:
            return '准备';
        break;
        case this.STATUS_RUNNING:
            return '正在采集';
        break;
        case this.STATUS_UPLOADING:
            return '正在上传';
        break;
        case this.STATUS_FINISH:
            return '已完成';
        break;
        case this.STATUS_STOPED:
            return '已停止';
        break;
        case this.STATUS_PAUSED:
            return '已暂停';
        break;
        case this.STATUS_FAILED:
            return '发生错误';
        break;
        case this.STATUS_DELETING:
            return '删除中';
        break;
        case this.STATUS_UPLOAD_FAILED:
            return '上传失败';
        break;
        }
    }

    this.init = () => {
        return new Promise( async ( resolve, reject ) => {
            try {
                db = await sqlite.open( config.DB_PATH );
                await db.exec( `
                    CREATE TABLE IF NOT EXISTS[kv] (
                        [key] CHAR(50) NOT NULL ON CONFLICT FAIL PRIMARY KEY ON CONFLICT FAIL, 
                        [value] TEXT);
                    CREATE UNIQUE INDEX IF NOT EXISTS [kv_key] ON [kv] ([key]);
                    CREATE TABLE IF NOT EXISTS [results] (
                        [id] INTEGER NOT NULL ON CONFLICT FAIL PRIMARY KEY ON CONFLICT FAIL AUTOINCREMENT, 
                        [taskid] GUID NOT NULL ON CONFLICT FAIL, 
                        [uid] CHAR(32) NOT NULL ON CONFLICT FAIL, 
                        [result] TEXT, 
                        [uploaded] BOOLEAN DEFAULT false);
                    CREATE TABLE IF NOT EXISTS [errors] (
                        [id] INTEGER NOT NULL ON CONFLICT FAIL PRIMARY KEY ON CONFLICT FAIL AUTOINCREMENT, 
                        [taskid] GUID NOT NULL ON CONFLICT FAIL, 
                        [url] CHAR(1024),
                        [time] DATETIME NOT NULL DEFAULT (datetime('now')), 
                        [info] TEXT, 
                        [frame] TEXT);
                    CREATE INDEX IF NOT EXISTS [results_upload] ON [results] ([uploaded]);
                    CREATE INDEX IF NOT EXISTS [results_taskid] ON [results] ([taskid]);
                    CREATE INDEX IF NOT EXISTS [results_uid] ON [results] ([taskid], [uid]);
                    CREATE TABLE IF NOT EXISTS [stack] (
                        [id] INTEGER NOT NULL ON CONFLICT FAIL PRIMARY KEY ON CONFLICT FAIL AUTOINCREMENT, 
                        [taskid] GUID NOT NULL ON CONFLICT FAIL, 
                        [frame] TEXT);
                    CREATE INDEX IF NOT EXISTS [stack_taskid] ON [stack] ([taskid]);
                    CREATE TABLE IF NOT EXISTS [tasks] (
                        [id] GUID NOT NULL, 
                        [starturl] CHAR(1024),
                        [config] TEXT, 
                        [status] TINYINT DEFAULT 0, 
                        [uploadoffset] INTEGER DEFAULT 0, 
                        [createtime] DATETIME NOT NULL DEFAULT (datetime('now')), 
                        CONSTRAINT [sqlite_autoindex_tasks] PRIMARY KEY ([id]));
                    CREATE INDEX IF NOT EXISTS [tasks_status] ON [tasks] ([status]);
                    CREATE INDEX IF NOT EXISTS [tasks_createtime] ON [tasks] ([createtime]);
                `);
                await this.task.clearDeleting();
                let concurrent = await ds.global.get('concurrent');
                if( !concurrent)
                    await ds.global.set('concurrent', 2);
                let retry = await ds.global.get('retry');
                if( !retry)
                    await ds.global.set('retry', 2);
                let uploadUrl = await ds.global.get('uploadUrl');
                if( !uploadUrl)
                    await ds.global.set('uploadUrl', 'http://127.0.0.1:3001/api/upload/');
            } catch (error) {
                reject( error);
            }
            resolve();
        });
    }
    //global
    this.global = new function () {
        this.set = ( key, value ) => {
            return cq.waitCall( 
                ( ) => { 
                    return db.run('REPLACE INTO kv (key, value) VALUES ($key, $value)', 
                        { $key: key, $value: JSON.stringify(value) } );
                }
            )
        }
        this.get = ( key ) => {
            return cq.waitCall( 
                ( ) => { 
                    return new Promise( async (resolve, reject) => { 
                        try {
                            let obj = await db.get('SELECT value from kv WHERE key = $key', 
                                { $key: key } );
                            if( obj)
                                resolve(JSON.parse(obj.value));
                        } catch (error) {
                            resolve();
                        }
                        resolve();
                    });
                }
            );
        }
    }
    this.results = {
        'get' : function ( id ) {
            return cq.waitCall( 
                ( ) => { 
                    return new Promise( async (resolve, reject) => { 
                        let obj = {};
                        try {
                            obj = await db.get('SELECT * FROM results WHERE id = $id', 
                                { $id: id } );
                        } catch (error) {
                            reject(error);
                        }
                        resolve(obj);
                    });
                }
            );
        },
        'insert' : function ( taskId, results ) {
            return cq.waitCall( 
                ( ) => { 
                    return new Promise( async (resolve, reject) => { 
                        try {
                            await db.run('BEGIN');
                            for( let result of results ) {
                                let g = await db.get('SELECT * FROM results WHERE taskid = $taskId AND uid = $uid', 
                                    { $taskId: taskId, $uid: result.uid } );
                                if( !g) {
                                    await db.run('REPLACE INTO results (taskid, uid, result) VALUES ($taskId, $uid, $result)', 
                                        { $taskId: taskId, $uid: result.uid, $result: JSON.stringify(result) } );
                                }
                            }
                            await db.run('COMMIT');
                        } catch (error) {
                            await db.run('ROLLBACK');
                            reject(error);
                        }
                        resolve();
                    });
                }
            );
        },
        'getCount' : function( taskId ) {
            return cq.waitCall( 
                ( ) => { 
                    return new Promise( async (resolve, reject) => { 
                        let total = 0;
                        try {
                            let obj = await db.get( 'SELECT count(*) as total FROM results WHERE taskid=$taskId', {
                                $taskId:taskId
                            } );
                            if( obj ) {
                                total = obj.total;
                            }
                        } catch (error) {
                            reject(error);
                        }
                        resolve(total);
                    });
                }
            );
        },
        'getList' : function( taskId, offset, count ) {
            return cq.waitCall( 
                ( ) => { 
                    return new Promise( async (resolve, reject) => { 
                        let list = [];
                        try {
                            let objs = await db.all( `
                            SELECT * FROM results WHERE taskid = $taskId ORDER BY id LIMIT $limit OFFSET $offset
                            `, { $taskId: taskId, $offset: offset, $limit: count } );
                            if( objs ) {
                                list = objs;
                            }
                        } catch (error) {
                            reject(error);
                        }
                        resolve(list);
                    });
                }
            );
        },
        'getListAll' : function( taskId) {
            return cq.waitCall( 
                ( ) => { 
                    return new Promise( async (resolve, reject) => { 
                        let list = [];
                        try {
                            let objs = await db.all( `
                            SELECT * FROM results WHERE taskid = $taskId ORDER BY id
                            `, { $taskId: taskId} );
                            if( objs ) {
                                list = objs;
                            }
                        } catch (error) {
                            reject(error);
                        }
                        resolve(list);
                    });
                }
            );
        }
    }
    this.errors = {
        'get' : function ( id ) {
            return cq.waitCall( 
                ( ) => { 
                    return new Promise( async (resolve, reject) => { 
                        let obj = {};
                        try {
                            obj = await db.get('SELECT * FROM errors WHERE id = $id', 
                                { $id: id } );
                        } catch (error) {
                            reject(error);
                        }
                        resolve(obj);
                    });
                }
            );
        },
        'insert' : function ( taskId, url, frame, errInfo ) {
            return cq.waitCall( 
                ( ) => { 
                    return new Promise( async (resolve, reject) => { 
                        try {
                            await db.run('REPLACE INTO errors (taskid, url, frame, info) VALUES ($taskId, $url, $frame, $info)', 
                                { $taskId: taskId, $url: url, $frame: JSON.stringify(frame), $info: errInfo } );
                        } catch (error) {
                            reject(error);
                        }
                        resolve();
                    });
                }
            );
        },
        'getCount' : function( taskId ) {
            return cq.waitCall( 
                ( ) => { 
                    return new Promise( async (resolve, reject) => { 
                        let total = 0;
                        try {
                            let obj = await db.get( 'SELECT count(*) as total FROM errors WHERE taskid=$taskId', {
                                $taskId:taskId
                            } );
                            if( obj ) {
                                total = obj.total;
                            }
                        } catch (error) {
                            reject(error);
                        }
                        resolve(total);
                    });
                }
            );
        },
        'getList' : function( taskId, offset, count ) {
            return cq.waitCall( 
                ( ) => { 
                    return new Promise( async (resolve, reject) => { 
                        let list = [];
                        try {
                            let objs = await db.all( `
                            SELECT * FROM errors WHERE taskid = $taskId ORDER BY id LIMIT $limit OFFSET $offset
                            `, { $taskId: taskId, $offset: offset, $limit: count } );
                            if( objs ) {
                                list = objs;
                            }
                        } catch (error) {
                            reject(error);
                        }
                        resolve(list);
                    });
                }
            );
        }
    }
    this.task = {
        'clearDeleting' : function( ) {
            return cq.waitCall( 
                ( ) => { 
                    return new Promise( async (resolve, reject) => { 
                        let info;
                        try {
                            await db.run('BEGIN');
                            let objs = await db.all( 'SELECT id FROM tasks WHERE status = $status', { $status: ds.STATUS_DELETING } );
                            if( objs ) {
                                for( let o of objs ) {
                                    await db.run('DELETE FROM tasks WHERE id = $taskId', { $taskId: o.id } );
                                    await db.run('DELETE FROM errors WHERE taskid = $taskId', { $taskId: o.id } );
                                    await db.run('DELETE FROM results WHERE taskid = $taskId', { $taskId: o.id } );
                                }
                            };
                            await db.run('COMMIT');
                        } catch (error) {
                            await db.run('ROLLBACK');
                            reject(error);
                        }
                        resolve( info );
                    });
                }
            );
        },
        'getCount' : function( ) {
            return cq.waitCall( 
                ( ) => { 
                    return new Promise( async (resolve, reject) => { 
                        let total = 0;
                        try {
                            let obj = await db.get( 'SELECT count(*) as total FROM tasks' );
                            if( obj ) {
                                total = obj.total;
                            }
                        } catch (error) {
                            reject(error);
                        }
                        resolve(total);
                    });
                }
            );
        },
        'getList' : function( offset, count ) {
            return cq.waitCall( 
                ( ) => { 
                    return new Promise( async (resolve, reject) => { 
                        let list = [];
                        try {
                            let objs = await db.all( `
                            SELECT tt.*,count(errors.id) as errorstotal FROM 
                            (SELECT t.*,count(results.id) as resultstotal FROM 
                            (SELECT * FROM tasks ORDER BY createtime DESC LIMIT $limit OFFSET $offset) t
                            LEFT JOIN results ON t.id == results.taskid GROUP BY t.id) tt
                            LEFT JOIN errors ON tt.id == errors.taskid GROUP BY tt.id ORDER BY createtime DESC
                            `, { $offset: offset, $limit: count } );
                            if( objs ) {
                                list = objs;
                            }
                        } catch (error) {
                            reject(error);
                        }
                        resolve(list);
                    });
                }
            );
        },
        'getRunningIds' : function ( ) {
            return cq.waitCall( 
                ( ) => { 
                    return new Promise( async (resolve, reject) => { 
                        let ids = [];
                        try {
                            let objs = await db.all( 'SELECT id FROM tasks WHERE status = $status1 OR status = $status2', { $status1: ds.STATUS_RUNNING, $status2: ds.STATUS_UPLOADING } );
                            if( objs ) {
                                for( let o of objs ) {
                                    ids.push( o.id );
                                }
                            }
                        } catch (error) {
                            reject(error);
                        }
                        resolve(ids);
                    });
                }
            );
        },
        'new' : function( startUrl, config ) {
            return cq.waitCall( 
                ( ) => { 
                    return new Promise( async (resolve, reject) => { 
                        try {
                            let id = uuid();
                            await db.run('INSERT INTO tasks (id, starturl, config) VALUES ($id, $starturl, $config)', 
                                { $id: id, $starturl: startUrl, $config: JSON.stringify(config) } );
                            resolve(id);
                        } catch (error) {
                            reject(error);
                        }
                        resolve();
                    });
                }
            );
        },
        'fetch' : function( ) {
            return cq.waitCall( 
                ( ) => { 
                    return new Promise( async (resolve, reject) => { 
                        let id;
                        try {
                            let obj = await db.get( 'SELECT id FROM tasks WHERE status = $status ORDER BY createtime', { $status: ds.STATUS_READY } );
                            if( obj)
                                id = obj.id;
                            await db.run( 'UPDATE tasks SET status = $status WHERE id = $id', { $status: ds.STATUS_RUNNING, $id: id } );
                        } catch (error) {
                            reject(error);
                        }
                        resolve(id);
                    });
                }
            );
        },
        'get' : function( id ) {
            return new function( ) {
                let __id = id;
                this.remove = ( ) => {
                    return cq.waitCall( 
                        ( ) => { 
                            return new Promise( async (resolve, reject) => { 
                                let info;
                                try {
                                    await db.run('BEGIN');
                                    await db.run('DELETE FROM tasks WHERE id = $taskId', { $taskId: __id } );
                                    await db.run('DELETE FROM errors WHERE taskid = $taskId', { $taskId: __id } );
                                    await db.run('DELETE FROM results WHERE taskid = $taskId', { $taskId: __id } );
                                    await db.run('COMMIT');
                                } catch (error) {
                                    await db.run('ROLLBACK');
                                    reject(error);
                                }
                                resolve( info );
                            });
                        }
                    );
                }
                this.info = ( status ) => {
                    return cq.waitCall( 
                        ( ) => { 
                            return new Promise( async (resolve, reject) => { 
                                let info;
                                try {
                                    let obj = await db.get('SELECT * FROM tasks WHERE id = $taskId', 
                                        { $taskId: __id } );
                                    if( obj) {
                                        info = obj;
                                        if( obj.config ) {
                                            info.config = JSON.parse( obj.config );
                                        }
                                    }
                                } catch (error) {
                                    reject(error);
                                }
                                resolve( info );
                            });
                        }
                    );
                }
                this.updateStatus = ( status ) => {
                    return cq.waitCall( 
                        ( ) => { 
                            return new Promise( async (resolve, reject) => { 
                                try {
                                    await db.run('UPDATE tasks SET status = $status WHERE id = $taskId', 
                                        { $status: status, $taskId: __id } );
                                } catch (error) {
                                    reject(error);
                                }
                                resolve();
                            });
                        }
                    );
                }
                this.getStatus = ( ) => {
                    return cq.waitCall( 
                        ( ) => { 
                            return new Promise( async (resolve, reject) => { 
                                let status;
                                try {
                                    let obj = await db.get('SELECT status FROM tasks WHERE id = $taskId', 
                                        { $taskId: __id } );
                                    if( obj)
                                        status = obj.status;
                                } catch (error) {
                                    reject(error);
                                }
                                resolve( status );
                            });
                        }
                    );
                }
                this.updateUploadOffset = ( offset ) => {
                    return cq.waitCall( 
                        ( ) => { 
                            return new Promise( async (resolve, reject) => { 
                                try {
                                    await db.run('UPDATE tasks SET uploadoffset = $offset WHERE id = $taskId', 
                                        { $offset: offset, $taskId: __id } );
                                } catch (error) {
                                    reject(error);
                                }
                                resolve();
                            });
                        }
                    );
                }
                this.getUploadOffset = ( ) => {
                    return cq.waitCall( 
                        ( ) => { 
                            return new Promise( async (resolve, reject) => { 
                                let offset;
                                try {
                                    let obj = await db.get('SELECT uploadoffset FROM tasks WHERE id = $taskId', 
                                        { $taskId: __id } );
                                    if( obj)
                                        offset = obj.uploadoffset;
                                } catch (error) {
                                    reject(error);
                                }
                                resolve( offset );
                            });
                        }
                    );
                }
                this.stack = new function () {
                    this.push = ( frame ) => {
                        return cq.waitCall( 
                            ( ) => { 
                                return new Promise( async (resolve, reject) => { 
                                    try {
                                        await db.run('INSERT INTO stack (taskid,frame) VALUES ($taskId, $frame)', 
                                            { $taskId: __id, $frame: JSON.stringify(frame) } );
                                    } catch (error) {
                                        reject(error);
                                    }
                                    resolve();
                                });
                            }
                        );
                    }
                    this.pushAll = ( frames ) => {
                        return cq.waitCall( 
                            ( ) => { 
                                return new Promise( async (resolve, reject) => { 
                                    try {
                                        await db.run('BEGIN');
                                        for( let frame in frames ) {
                                            await db.run('INSERT INTO stack (taskid, frame) VALUES ($taskId, $frame)', 
                                                { $taskId: __id, $frame: JSON.stringify(frame) } );
                                        }
                                        await db.run('COMMIT');
                                    } catch (error) {
                                        await db.run('ROLLBACK');
                                        reject(error);
                                    }
                                    resolve();
                                });
                            }
                        );
                    }
                    this.pop = () => {
                        return cq.waitCall( 
                            ( ) => { 
                                return new Promise( async (resolve, reject) => { 
                                    let frame;
                                    try {
                                        let id = 0;
                                        let obj = await db.get( 'SELECT * FROM stack WHERE taskid = $taskId ORDER BY id desc LIMIT 1',
                                        { $taskId: __id } );

                                        if( obj ) {
                                            frame = JSON.parse(obj.frame || '{}');
                                            id = obj.id;
                                            await db.run('DELETE FROM stack WHERE id = $id', 
                                                { $id: id} );
                                        }
                                    } catch (error) {
                                        reject(error);
                                    }
                                    resolve( frame);
                                });
                            }
                        );
                    }
                    this.top = () => {
                        return cq.waitCall( 
                            ( ) => { 
                                return new Promise( async (resolve, reject) => { 
                                    let frame;
                                    try {
                                        let obj = await db.get( 'SELECT * FROM stack WHERE taskid = $taskId ORDER BY id desc LIMIT 1',
                                        { $taskId: __id } );
                                        
                                        if( obj ) {
                                            frame = JSON.parse(obj.frame || '{}');
                                        }
                                    } catch (error) {
                                        reject(error);
                                    }
                                    resolve( frame);
                                });
                            }
                        );
                    }
                    this.size = () => {
                        return cq.waitCall( 
                            ( ) => { 
                                return new Promise( async (resolve, reject) => { 
                                    let c = 0;
                                    try {
                                        let obj = await db.get( 'SELECT count(*) AS c FROM stack WHERE taskid = $taskId',
                                        { $taskId: __id } );
                                        
                                        if( obj ) {
                                            c = obj.c || c;
                                        }
                                    } catch (error) {
                                        reject(error);
                                    }
                                    resolve( c );
                                });
                            }
                        );
                    }
                    this.get = (index) => {
                        return cq.waitCall( 
                            ( ) => { 
                                return new Promise( async (resolve, reject) => { 
                                    let frame;
                                    try {
                                        let obj = await db.get( 'SELECT * FROM stack WHERE taskid = $taskId ORDER BY id LIMIT 1 OFFSET $offset',
                                        { $taskId: __id, $offset: index} );
                                        if( obj ) {
                                            frame = JSON.parse(obj.frame || '{}');
                                        }
                                    } catch (error) {
                                        reject(error);
                                    }
                                    resolve( frame);
                                });
                            }
                        );
                    }
                }
                this.config = new function () {
                    this.set = (key, value) => {
                        return cq.waitCall( 
                            ( ) => { 
                                return new Promise( async (resolve, reject) => { 
                                    let config = '{}';
                                    try {
                                        let obj = await db.get( 'SELECT config FROM tasks WHERE id = $id', { $id: __id } );
                                        if( obj)
                                            config = obj.config || config;
                                        config = JSON.parse(config);
                                        config[key] = value;
                                        await db.run( 'UPDATE tasks SET config = $config WHERE id = $id', { $config: JSON.stringify(config), $id: __id } );
                                    } catch (error) {
                                        reject(error);
                                    }
                                    resolve();
                                });
                            }
                        );
                    }
                    this.get = (key) => {
                        return cq.waitCall( 
                            ( ) => { 
                                return new Promise( async (resolve, reject) => { 
                                    let config = '{}';
                                    try {
                                        let obj = await db.get( 'SELECT config FROM tasks WHERE id = $id', { $id: __id } );
                                        if( obj)
                                            config = obj.config || config;
                                        config = JSON.parse(config);
                                        resolve( config[key] );
                                    } catch (error) {
                                        reject(error);
                                    }
                                    resolve();
                                });
                            }
                        );
                    }
                }
            }
        }
    }
};