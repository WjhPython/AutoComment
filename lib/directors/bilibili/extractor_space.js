/**
 * http://space.bilibili.com/105980078#!/video?keyword=&order=pubdate&page=1&tid=0
 * 作者视频列表页提取器
 */

const request = require('request-promise');

let Extractor = { };

Extractor.Constant = {
    type:'space'
};

Extractor.Class = function() {
    require('../../extractor').call( this );
    this.go = ( frame, director ) => {
        return new Promise( async (resolve, reject) => {
            let result = [];
            try {
                if( !/space\.bilibili\.com/.test( frame.url))
                    return;

                let mid = (/space\.bilibili\.com\/(\d+)/.exec( frame.url) || [])[1] || (/mid=([^&]+)/.exec( frame.url) || [])[1];
                if( !mid )
                    return;

                let page = (/page=([^&]+)/.exec( frame.url) || [])[1] || 1;
                let tid = (/tid=([^&]+)/.exec( frame.url) || [])[1] || 0;
                let order = (/order=([^&]+)/.exec( frame.url) || [])[1] || 'pubdate';

                let requestUrl = 'http://space.bilibili.com/ajax/member/getSubmitVideos?mid=' + mid + '&pagesize=30&tid=' + tid + '&page=' + page + '&keyword=&order=' + order;

                await director.task.config.set( 'timeLimit', true );
                let content = await request( requestUrl, { gzip: true } );
                if( !content )
                    return;
                let root = JSON.parse( content);
                if( !root.status)
                    return;
                let archives = root.data.vlist;
                if( !archives || archives.length == 0 )
                    return;
                let timeLimit = await director.task.config.get( 'timeLimit' );
                for( let arch of archives ) {
                    if( timeLimit && arch.duration > 600 )
                        continue;
                    let newFrame = {
                        type:'extractor',
                        extractorType: require('./extractor_video').Constant.type,
                        url:'http://m.bilibili.com/video/av' + arch.aid + '.html',
                        result:{
                            sourceUrl:'http://www.bilibili.com/video/av' + arch.aid,
                            pic:arch.pic.replace( /^\/\//, 'http://'),
                            title:arch.title,
                            nick:arch.author,
                            face:'',
                            createTime:new Date(arch.created*1000),
                            duration:0,
                            siteName:'bilibili',
                            danmaku:[]
                        },
                        local:{
                            aid:arch.aid
                        }
                    };

                    result.unshift( newFrame );
                }

                page++;
                frame.url = 'http://space.bilibili.com/ajax/member/getSubmitVideos?mid=' + mid + '&pagesize=30&tid=' + tid + '&page=' + page + '&keyword=&order=' + order;
                frame.extractorType = require('./extractor_space').Constant.type;
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