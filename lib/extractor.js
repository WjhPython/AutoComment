module.exports = function( ) {
    this.__go = ( frame, director ) => {
        if( !this.go)
            throw 'must implement';
        return this.go( frame, director );
    }
}