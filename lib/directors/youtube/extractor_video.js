/**
 * https://www.youtube.com/watch?v=bSmCR_bFFm0
 * 视频详情页提取器
 */

const helper = require('../../helper');
const request = require('request-promise');
const puppeteer = require('puppeteer');
const config = require('../../config');

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
                let vid = helper.matchOneString( frame.url, /youtu\.be\/([^\/]+)/) ||
                helper.matchOneString( frame.url, /youtube\.com\/embed\/([^\/?]+)/) ||
                helper.matchOneString( frame.url, /youtube\.com\/v\/([^\/?]+)/) ||
                helper.matchOneString( frame.url, /youtube\.com\/watch\/([^\/?]+)/) ||
                helper.queryString( frame.url, "v") ||
                helper.queryString( helper.queryString("u", frame.url), "v");
                if( !vid )
                    return;

                const browser = await puppeteer.launch( { headless: !config.debug } );
                let interv;
                let timeo;
                try {
                    let comment = '';
                    const page = await browser.newPage();
                    //await page.setViewport( { 'width':1920, 'height':1080 } );
                    await page.setExtraHTTPHeaders( { 'Accept-Language' : 'zh-CN,zh;q=0.8,en;q=0.6', 'Cookie': new Buffer(config.cookie, 'base64').toString()} );
                    await page.setRequestInterceptionEnabled(true);
                    page.on('request', interceptedRequest => {
                        interceptedRequest.continue();
                    });
                    page.on('response', async response => {
                        if( response.url.indexOf('comment_service_ajax') > 0) {
                            if( interv ) {
                                clearInterval( interv);
                                interv = null;
                            }
                            comment = await response.text();
                            page.evaluate( _ => {
                                window.my_comment = true;
                            });
                        }
                    });
                    await page.goto(frame.url);
                    let content = await page.content();
                    if( !content)
                        return;

                    if( content.indexOf('此视频已停用评论功能') == -1 ) {
                        const dimensions = await page.evaluate(() => {
                            return {
                                width: document.documentElement.clientWidth,
                                height: document.documentElement.clientHeight,
                                deviceScaleFactor: window.devicePixelRatio
                            };
                        });
    
                        interv = setInterval( async ()=>{
                            await page.evaluate( _ => {
                                window.scrollBy(0, window.innerHeight);
                            });
                        }, 500);
                        
                        await page.evaluate( _ => {
                            window.my_comment = false;
                        });
                        
                        await page.waitForFunction('window.my_comment');
                    }

                    var playerConfig = helper.matchOneString( content, /ytplayer\.config\s=\s(\{.*\});ytplayer\.load/);
                    if( !playerConfig)
                        return;
                    var configJson = JSON.parse( playerConfig );
                    var videoInfo = configJson.args;
                    if( !videoInfo)
                        return;
                    frame = {
                        result: {}
                    };
                    let createTime = helper.matchOneString( content, /"dateText":{"simpleText":"(.*?)日发布"/);
                    if( createTime)
                        createTime = new Date(createTime.replace('年','-').replace('月','-'));
                    
                    frame.result.uid = require("md5")( 'ixigua-vid-' + vid );
                    frame.result.sourceUrl = 'https://www.youtube.com/watch?v=' + vid;
                    frame.result.pic = 'https://i.ytimg.com/vi/' + vid + '/hqdefault.jpg';
                    frame.result.title = videoInfo.title;
                    if( videoInfo.ucid )
                        frame.result.userId = require("md5")( 'youtue-userid-' + videoInfo.ucid )
                    frame.result.nick = videoInfo.author;
                    frame.result.face = helper.matchOneString( content, /"videoOwnerRenderer":\{"thumbnail":\{"thumbnails":\[\{"url":"(.*?)"/);
                    frame.result.createTime = createTime || undefined;
                    frame.result.duration = videoInfo.length_seconds * 1000;
                    frame.result.siteName = 'youtube';
                    frame.result.danmaku = [];

                    if( comment ) {
                        try {
                            let root = JSON.parse( comment);
                            let comments = root.response.continuationContents.itemSectionContinuation.contents;
                            if( comments ) {
                                for( let comment of comments ) {

                                    let c =  comment.commentThreadRenderer.comment.commentRenderer.contentText.simpleText;
                                    if(!c)
                                    {
                                        let runs = comment.commentThreadRenderer.comment.commentRenderer.contentText.runs;
                                        if(runs && runs.length > 0)
                                        {
                                            c = runs[0].text;
                                        }
                                    }

                                    if(!c)
                                    {
                                        continue;
                                    }

                                    frame.result.danmaku.push(
                                        {
                                            t:parseInt((frame.result.duration-1)*Math.random()),
                                            c:c
                                        }
                                    );
                                }
                            }
                        } catch (error) {
                            console.error(error);
                        }
                    }

                    frame.type = 'result';
                    result.push( frame);
                } catch (error) {
                    console.error( error);
                    reject(error);
                } finally {
                    if( interv)
                        clearInterval( interv );
                    await browser.close();
                }
                /*let content = await request( frame.url , { gzip: true } );
                if( !content )
                    return;*/

                /*
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
                */
            } catch (error) {
                console.log( error);
            } finally {
                resolve( result);
            }
        });
    };
}

module.exports = Extractor;