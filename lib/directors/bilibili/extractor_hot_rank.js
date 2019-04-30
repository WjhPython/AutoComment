/**
 * http://s.search.bilibili.com/cate/search?main_ver=v3&search_type=video&view_type=hot_rank&pic_size=160x100&order=hot&copy_right=-1&cate_id=138&page=1&pagesize=20&keyword=%E6%82%B2%E5%89%A7%E7%A2%89%E5%A0%A1%E5%82%BB%E7%BC%BA
 * 热度排序接口提取器
 */

const request = require('request-promise');

let Extractor = { };

Extractor.Constant = {
    type:'hot_rank'
};

Extractor.Class = function() {
    require('../../extractor').call( this );
    this.go = ( frame, director ) => {
        return new Promise( async (resolve, reject) => {
            let result = [];
            try {
                if( frame.extractorType != Extractor.Constant.type)
                    return;
                if( !frame.local.page)
                    return;
                let requestUrl = frame.url + '&page=' + frame.local.page;
                let content = await request( requestUrl, { gzip: true } );
                if( !content )
                    return;
                let root = JSON.parse( content);
                if( root.code != 0)
                    return;
                let archives = root.result;
                if( !archives || archives.length == 0 )
                    return;
                let timeLimit = await director.task.config.get( 'timeLimit' );
                for( let arch of archives ) {
                    if( timeLimit && arch.duration > 600 )
                        continue;
                    let newFrame = {
                        type:'extractor',
                        extractorType: require('./extractor_video').Constant.type,
                        url:'http://m.bilibili.com/video/av' + arch.id + '.html',
                        result:{
                            sourceUrl:'http://www.bilibili.com/video/av' + arch.id,
                            pic:arch.pic.replace( /^\/\//, 'http://'),
                            title:arch.title,
                            nick:arch.author,
                            face:'',
                            createTime:new Date(arch.senddate*1000),
                            duration:arch.duration*1000,
                            siteName:'bilibili',
                            danmaku:[]
                        },
                        local:{
                            aid:arch.aid
                        }
                    };

                    result.unshift( newFrame );
                }

                frame.local.page++;
                result.unshift( frame );
            } catch (error) {
                console.log( error);
                reject(error);
            } finally {
                resolve( result );
            }
        });
    };
}

module.exports = Extractor;