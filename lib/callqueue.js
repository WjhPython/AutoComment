module.exports = function ( ) {
    let queue = [];
    let running = false;
    this.waitCall = ( func ) =>  {
        return new Promise( async (resolve, reject) => {
            //console.log('call');
            queue.push(
                {
                    func: func,
                    resolve: resolve,
                    reject: reject
                } 
            );
            if( running )
                return;
            running = true;
            //console.log('in');
            while( queue.length ) {
                let task = queue.shift();
                try {
                    task.resolve( await task.func() );
                } catch (error) {
                    task.reject(error);
                }
            }
            //console.log('out');
            running = false;
        } );
    }
};