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
                let gid = (/ixigua\.com\/[a-z](\d+)/.exec( frame.url)||[])[1] || (/ixigua\.com\/group\/(\d+)/.exec( frame.url)||[])[1];
                if( !gid)
                    return;

                let content = await request( frame.url , { gzip: true } );
                if( !content )
                    return;
                let json = (/var BASE_DATA = (\{[\s\S]*?\});/.exec( content )||[])[1];
                if( !json)
                    return;
                json = json.replace('siblings: siblingList,','');
                let root;
                eval('root=' + json);
                if( !frame.result )
                    frame.result = {};

                frame.result.uid = require("md5")( 'ixigua-vid-' + root.shareInfo.groupId + root.shareInfo.itemId );
                frame.result.sourceUrl = frame.url;
                frame.result.pic = '';
                frame.result.title = root.abstractInfo.title;
				if( root.abstractInfo.mediaId)
                	frame.result.userId = require("md5")( 'ixigua-userid-' + root.abstractInfo.mediaId );
                frame.result.nick = root.abstractInfo.name;
                frame.result.face = root.abstractInfo.avatarUrl;
                frame.result.createTime = 0;
                frame.result.duration = 0;
                frame.result.siteName = 'xigua';
                frame.result.danmaku = [];
                frame.type = 'extractor';
                frame.extractorType = require('./extractor_info').Constant.type;
                frame.url = 'http://m.365yg.com/i' + root.shareInfo.itemId + '/info/';
                frame.local = {
                    groupId: root.shareInfo.groupId,
                    itemId: root.shareInfo.itemId,
                    videoId: root.playerInfo.videoId
                }
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