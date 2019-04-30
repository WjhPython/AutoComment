/**
 * https://v.qq.com/x/page/l05501dfshh.html
 * 视频详情页提取器
 * 
 * 需要采集：
 * 视频唯一id
 * 源地址
 * 图片
 * 标题
 * 昵称
 * 头像
 * 上传时间
 * 时长
 * 站点名称
 * 字幕;
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
                if( !/\/[a-z0-9]+\.html/.test(frame.url))
                    return;
                let content = await request( frame.url , { gzip: true } );
                if( !content )
                    return;
                let vid = (/vid"*\s*:\s*"\s*([^"]+)"/.exec( content)||[])[1];
                if( !vid)
                    return;
                if( !frame.result )
                    frame.result = {};

                frame.result.uid = require("md5")( 'qq-vid-' + vid );
                frame.result.sourceUrl = frame.url;
                let pic = (/"pic_640_360":"(.*?)"/.exec( content)||[])[1];
                if( pic.indexOf("undefined") > -1 || !pic)
                    (/itemprop="thumbnailUrl" content="(.*?)"/.exec( content)||[])[1];
                if( pic.indexOf("undefined") > -1 || !pic)
                    pic = undefined;
                frame.result.pic = pic;
                frame.result.title = (/var VIDEO_INFO = {[\s\S]+?"?title"?\s*?:\s*?"(.*?)"/.exec( content)||[])[1];
                let userId = (/vplus\/(.*?)"/.exec( content)||[])[1];
                if( userId )
                    frame.result.userId = frame.result.userId || require("md5")( 'qq-userid-' + userId );
                frame.result.nick = frame.result.nick || (/<span class="user_name">(.*?)</.exec( content)||[])[1];
                frame.result.face = frame.result.face || (/<img class="user_avatar" src="(.*?)"/.exec( content)||[])[1];
                if( frame.result.face && frame.result.face.startsWith('//'))
                    frame.result.face = 'http:' + frame.result.face;
                let pubDate = (/itemprop="datePublished" content="(.*?)"/.exec( content)||[])[1];
                if( pubDate == "null" || !pubDate)
                    pubDate = (/"publish_date":"(.*?)"/.exec( content)||[])[1];
                if( !new Date(pubDate).getTime())
                    pubDate = ((/<span class="date _date">(.*?)日发布<\/span>/.exec( content)||[])[1] || "").replace('年','-').replace('月','-');
                if( !pubDate || !new Date(pubDate).getTime())
                    pubDate = (/"modify_time":"(.*?)"/.exec( content)||[])[1];
                frame.result.createTime = new Date(pubDate);
                frame.result.duration = parseInt((/itemprop="duration" content="(.*?)"/.exec( content)||[])[1]) * 1000 ||
                parseInt((/"duration":"(.*?)"/.exec( content)||[])[1]) * 1000;
                frame.result.siteName = 'qq';
                frame.result.danmaku = [];
                frame.extractorType = require('./extractor_danmaku_key').Constant.type;

                frame.url = 'http://bullet.video.qq.com/fcgi-bin/target/regist?otype=json&vid=' + vid;
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