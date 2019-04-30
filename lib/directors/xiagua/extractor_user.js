/**
 * https://www.ixigua.com/c/user/5991165434/
 * 作者视频列表页提取器
 */

const request = require('request-promise');

let Extractor = { };

Extractor.Constant = {
    type:'user'
};

Extractor.Class = function() {
    require('../../extractor').call( this );
    this.go = ( frame, director ) => {
        return new Promise( async (resolve, reject) => {
            let result = [];
            try {
                let userId = (/\/user\/(\d+)/.exec( frame.url ) || [])[1];
                if( !userId) {
                    userId = (/user_id=([^&]+)/.exec( frame.url ) || [])[1];
                    if( !userId)
                        return;
                }
                let maxBehotTime = (/max_behot_time=([^&]+)/.exec( frame.url ) || [])[1];
                if( maxBehotTime)
                    maxBehotTime = '&max_behot_time=' + maxBehotTime;
                let requestUrl = 'https://www.ixigua.com/c/user/article/?user_id=' + userId +'&count=100' + (maxBehotTime || '');
                let content = await request( requestUrl, { gzip: true } );
                if( !content)
                    return;
                await director.task.config.set( 'timeLimit', true );
                let root = JSON.parse( content);
                if( root.message != 'success')
                    return;
                let archives = root.data;
                if( !archives || archives.length == 0 )
                    return;
                let timeLimit = await director.task.config.get( 'timeLimit' );
                for( let arch of archives ) {
                    if( arch.video_duration_str ) {
                        let dur = arch.video_duration_str.split(':');
                        if( dur.length != 2)
                            continue;
                        if( timeLimit && parseInt(dur[0]) * 60 + parseInt(dur[1]) > 600)
                            continue;
                    }
                    let newFrame = {
                        type:'extractor',
                        extractorType: require('./extractor_video').Constant.type,
                        url:arch.display_url.replace('toutiao.com','ixigua.com'),
                        result:{ }
                    };
                    result.unshift( newFrame );
                }

                try {
                    if( root.has_more ) {
                        frame.extractorType = Extractor.Constant;
                        frame.url = 'https://www.ixigua.com/c/user/article/?user_id=' + userId +'&count=100&max_behot_time=' + root.next.max_behot_time;
                        result.unshift( frame );
                    }
                } catch (error) {
                    console.error(error);
                    reject(error);
                }
            } catch (error) {
                console.log( error);
            } finally {
                resolve( result );
            }
        });
    };
}

module.exports = Extractor;