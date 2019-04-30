module.exports = {
    debug: true, // 开启debug模式
    waitTimeInterval: 1,  // 打开商品页面之后，睡眠一段时间(秒)，再提交评论
    pageNumber: 1,  // 一次并发执行的页面数量
    OpenNextPageTime: 5,  // 距离下一次发起并发执行的时间间隔
    closePage: true
}