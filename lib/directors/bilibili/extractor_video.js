/**
 * http://www.bilibili.com/video/av3441899/
 * 视频详情页提取器
 */
const request = require('request-promise');

let Extractor = { };

Extractor.Constant = {
    type:'video'
};

Extractor.Class = function() {
    require('../../extractor').call( this );
    this.go = ( frame, director ) => {
        return new Promise( async (resolve, reject) => {
            let result = [];
            try {
                if( !/\/video\/av\d+/.test( frame.url) )
                    return;
                let aid;
                if( frame.local )
                    aid = frame.local.aid
                if( !aid)
                    aid = (/\/video\/av(\d+)/.exec( frame.url)||[])[1];
                if( !aid )
                    return;
                let content = await request( 'http://m.bilibili.com/video/av' + aid + '.html', 
                    { gzip: true,
                        headers:{ 'User-Agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 10_3 like Mac OS X) AppleWebKit/602.1.50 (KHTML, like Gecko) CriOS/56.0.2924.75 Mobile/14E5239e Safari/602.1' }
                    } );
                if( !content )
                    return;
                let json = (/window\.__INITIAL_STATE__\s*=\s*(\{.*?\});/.exec( content )||[])[1];

                let root = JSON.parse(json);
                if( !frame.result )
                    frame.result = {};

                if( root.reduxAsyncConnect.videoTag ) {

                    let tags = root.reduxAsyncConnect.videoTag;
                    if( tags ) {
                        frame.result.tags = [];
                        tags.forEach( element => {
                            frame.result.tags.push( element.tag_name );
                        } );
                    }
                }

                //2018年5月4日发现找不到videoMessage，下面直接是videoInfo，多加个兼容性判断
                //let fields = root.reduxAsyncConnect.videoMessage.videoInfo.fields;
                let fields;
                if( root.reduxAsyncConnect.videoMessage)
                {
                    fields = root.reduxAsyncConnect.videoMessage.videoInfo.fields;
                }
                else
                {
                    fields = {};
                }


                let videoInfo = root.reduxAsyncConnect.videoInfo || {};
              
                let mid = (fields.mid || videoInfo.owner.mid);
                let pubdate = fields.pubdate || videoInfo.pubdate;
              
                frame.result.sourceUrl = frame.result.sourceUrl || 'http://www.bilibili.com/video/av' + aid;
                frame.result.pic = frame.result.pic || fields.litpic ||videoInfo.pic;
                frame.result.title = frame.result.title || fields.title || videoInfo.title;
                if( mid)
                    frame.result.userId = frame.result.userId || require("md5")( 'bilibili-userid-' + mid );
                frame.result.nick = frame.result.nick || fields.writer || videoInfo.owner.name;
                frame.result.face = frame.result.face || (fields.up_info && fields.up_info.face) || videoInfo.owner.face;
                frame.result.createTime = frame.result.createTime || new Date(pubdate*1000);
                frame.result.siteName = 'bilibili';
                frame.result.danmaku = frame.result.danmaku || [];
                frame.type = 'extractor';
                frame.extractorType = require('./extractor_playurl').Constant.type;
                frame.url = 'http://api.bilibili.com/playurl?aid=' + aid;
                result.push( frame);
            } catch (error) {
                console.log( error);
                reject(error);
            } finally {
                resolve( result);
            }
        });
    };
}

module.exports = Extractor;