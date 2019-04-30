const { EventEmitter } = require('events');

module.exports = new function ( ) {
    let wait = [];
    let inside = false;
    this.lock = ( ) =>  {
        return new Promise( async (resolve) => {
            if( inside ) {
                wait.push(()=>{
                    resolve();
                });
            }
            else {
                inside = true;
                resolve();
            }
        } );
    }
    this.unlock = ( ) =>  {
        inside = false;
        if( !wait.length)
            return;
        let func = wait.shift();
        func();
    }
};