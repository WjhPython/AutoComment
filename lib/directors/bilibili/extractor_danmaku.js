/**
 * https://comment.bilibili.com/24814919.xml
 * 字幕提取器
 */

const request = require('request-promise');
const xml2js = require('xml2js');
const zlib = require('zlib');
var Curl = require( 'node-libcurl' ).Curl;

let Extractor = { };

Extractor.Constant = {
    type:'danmaku'
};

Extractor.Class = function() {
    require('../../extractor').call( this );
    this.go = ( frame, director ) => {
        return new Promise( async (resolve, reject) => {
            let result = [];
            try {
                if( frame.extractorType != Extractor.Constant.type )
                    return;
                frame.result.uid = require("md5")( 'bilibili-cid-' + (/\/(\d+)\.xml/.exec( frame.url) || [])[1] );
                let content = await new Promise( ( resolve, reject ) => {
                    var curl = new Curl();
                    curl.setOpt( 'URL', frame.url );
                    curl.setOpt( 'FOLLOWLOCATION', true );
                    curl.setOpt( 'SSL_VERIFYPEER', false );
                    curl.setOpt( 'SSL_VERIFYHOST', false );
                    curl.setOpt( 'ENCODING', 'deflate' );
                    curl.on( 'end', function( statusCode, body, headers ) {
                        this.close();
                        resolve(body);
                    });
                    curl.on( 'error', ( error ) => {
                        curl.close.bind( curl );
                        reject( error );
                    });
                    curl.perform();
                })
                
                let root = await new Promise( ( resolve, reject ) => {
                    xml2js.parseString( content, ( error, doc) => {
                        if( error)
                            reject( error);
                        resolve( doc);
                    } );
                })
                let danmaku = root.i.d;
                if( danmaku ) {
                    for( let d of danmaku ) {
                        frame.result.danmaku.push(
                            {
                                t:parseInt(parseFloat(d.$.p.split(',')[0])*1000),
                                c:d._
                            }
                        );
                    }
                }
                frame.type = 'result';
                result.push(frame);
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