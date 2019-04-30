/**
 * https://www.ixigua.com/i6317191790197735938/
 * 视频详情页提取器
 */

const request = require('request-promise');

let Extractor = { };

Extractor.Constant = {
    type:'info'
};

Extractor.Class = function() {
    require('../../extractor').call( this );
    this.go = ( frame, director ) => {
        return new Promise( async (resolve, reject) => {
            let result = [];
            try {
                if( frame.extractorType != Extractor.Constant.type )
                    return;
                let content = await request( frame.url , { gzip: true } );
                if( !content )
                    return;
                let root = JSON.parse(content);
                if( !root.success )
                    return;
                if( !frame.result )
                    frame.result = {};

                frame.result.createTime = new Date( root.data.publish_time*1000 );
                frame.result.pic = (/tt-poster='([^']+)'/.exec( root.data.content )||[])[1] || '';
                frame.type = 'extractor';
                frame.extractorType = require('./extractor_duration').Constant.type;
                
                //计算密钥
                let stuff = '/video/urls/v/1/toutiao/mp4/' + frame.local.videoId + '?r='+Math.random().toString(10).substring(2);
                var n = function() {
                    for (var t = 0, e = new Array(256), n = 0; 256 != n; ++n)
                        t = n,
                        t = 1 & t ? -306674912 ^ t >>> 1 : t >>> 1,
                        t = 1 & t ? -306674912 ^ t >>> 1 : t >>> 1,
                        t = 1 & t ? -306674912 ^ t >>> 1 : t >>> 1,
                        t = 1 & t ? -306674912 ^ t >>> 1 : t >>> 1,
                        t = 1 & t ? -306674912 ^ t >>> 1 : t >>> 1,
                        t = 1 & t ? -306674912 ^ t >>> 1 : t >>> 1,
                        t = 1 & t ? -306674912 ^ t >>> 1 : t >>> 1,
                        t = 1 & t ? -306674912 ^ t >>> 1 : t >>> 1,
                        e[n] = t;
                    return "undefined" != typeof Int32Array ? new Int32Array(e) : e
                }()
                  , o = function(t) {
                    for (var e, o, r = -1, i = 0, a = t.length; i < a; )
                        e = t.charCodeAt(i++),
                        e < 128 ? r = r >>> 8 ^ n[255 & (r ^ e)] : e < 2048 ? (r = r >>> 8 ^ n[255 & (r ^ (192 | e >> 6 & 31))],
                        r = r >>> 8 ^ n[255 & (r ^ (128 | 63 & e))]) : e >= 55296 && e < 57344 ? (e = (1023 & e) + 64,
                        o = 1023 & t.charCodeAt(i++),
                        r = r >>> 8 ^ n[255 & (r ^ (240 | e >> 8 & 7))],
                        r = r >>> 8 ^ n[255 & (r ^ (128 | e >> 2 & 63))],
                        r = r >>> 8 ^ n[255 & (r ^ (128 | o >> 6 & 15 | (3 & e) << 4))],
                        r = r >>> 8 ^ n[255 & (r ^ (128 | 63 & o))]) : (r = r >>> 8 ^ n[255 & (r ^ (224 | e >> 12 & 15))],
                        r = r >>> 8 ^ n[255 & (r ^ (128 | e >> 6 & 63))],
                        r = r >>> 8 ^ n[255 & (r ^ (128 | 63 & e))]);
                    return r ^ -1
                }
                var i = o(stuff)>>>0;
                frame.url = 'http://ib.365yg.com' + stuff + '&s=' + i;
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