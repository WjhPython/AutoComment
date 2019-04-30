/**
 * http://www.bilibili.com/video/ent_funny_1.html
 * http://www.bilibili.com/video/ent_funny_1.html#!page=1&range=2017-10-05,2017-10-12&order=dm
 * 标签列表页提取器
 */

const request = require('request-promise');

let Extractor = { };

Extractor.Constant = {
    type:'tag_list'
};

Extractor.Class = function() {
    require('../../extractor').call( this );
    this.go = ( frame, director ) => {
        return new Promise( async (resolve, reject) => {
            let result = [];
            try {
                if( /\/video\/av\d+\//.test( frame.url) )
                    return;
                if( /space\.bilibili\.com/.test( frame.url) )
                    return;
                let content = await request( frame.url, {gzip: true});
                let tid = (/var tid = '(\d+)'/.exec( content ) || [])[1];
                if( !tid )
                    return;
                await director.task.config.set( 'timeLimit', true );
                let newFrame = {
                    type:'extractor',
                    local:{}
                };
                newFrame.local.page = (/page=([^&]+)/.exec( frame.url) || [])[1] || 1;
                let tagid = (/tagid=([^&]+)/.exec( frame.url) || [])[1];
                let tag = (/tag=([^&]+)/.exec( frame.url) || [])[1];
                let original = (/original=([^&]+)/.exec( frame.url) || [])[1]?1:0;
                let order = (/order=([^&]+)/.exec( frame.url) || [])[1] || 'default';
                let days = (/days=([^&]+)/.exec( frame.url) || [])[1];
                let range = (/range=([^&]+)/.exec( frame.url) || [])[1];
                if( !tagid && order == 'default') {
                    newFrame.url = 'http://api.bilibili.com/archive_rank/getarchiverankbypartion?type=json&ps=20&tid=' + tid + "&original" + original;
                    newFrame.extractorType = require('./extractor_archive_rank').Constant.type;
                }
                else if( order == 'default' ) {
                    newFrame.url = 'http://api.bilibili.com/x/tag/ranking/archives?ps=20&tag_id=' + tagid + '&rid=' + tid + "&type=" + original;
                    newFrame.extractorType = require('./extractor_archive_rank').Constant.type;
                }
                else {
                    let rangeStr;
                    if( range ) {
                        range = range.replace( /-/g, '' );
                        range = range.split( ',' );
                        if( range.length == 2) {
                            rangeStr = '&time_from=' + range[0] + '&time_to=' + range[1];
                        }
                    }
                    newFrame.url = 'http://s.search.bilibili.com/cate/search?main_ver=v3&search_type=video&view_type=hot_rank&pagesize=20&cate_id=' + tid + (tag?('&keyword=' + tag):'') + '&copy_right=' + ( original || -1 ) + '&order=' + order + ( rangeStr || '' );
                    newFrame.extractorType = require('./extractor_hot_rank').Constant.type;
                }
                if( newFrame.url ) {
                    result.push( newFrame );
                }
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