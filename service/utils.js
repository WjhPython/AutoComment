
module.exports = new class {
    constructor(){}

    async findOneString(str, pattern){
        let ra = pattern.exec(str);
        return (ra && ra[1]) || "";
    }
}