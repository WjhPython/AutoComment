const router = require('koa-router')()
const comment = require('../service/comment')
const fs = require('fs')
const readline = require('readline')

router.get('/', async (ctx, next) => {
  
  // 读取配置文件， 填充cookie
  let data = [];
  let path = 'cookie.txt';
  if (fs.existsSync(path)){
    let info = fs.readFileSync(path).toString();
    data = info.split('\r\n') || info.split('\n');
    data = data.filter(d=>d);
  }else{
    console.log("cookie.txt： 文件不存在，或者文件位置不正确,如果想批量添加cookie, 请创建并存放在根目录下")
  }

  await ctx.render('task-new', {
      title: '济南点量软件', cookie: data
  });
})

// 填写链接
router.post("/task-new", async (ctx, next) =>{
  try {
    if (ctx.request.body.start_url){
      let params = {}
      params.url = ctx.request.body.start_url;
      params.cookie = ctx.request.body.login_cookie;
      params.comments = ctx.request.body.comments;
      await comment.parser(params)
      ctx.body = {
        code: 200,
        message: "success"
      }

    }
  } catch (error) {
    ctx.body = {
      code: 1,
      message: "error"
    }
  }
})

router.get("/task-progress", async (ctx, next) => {
  try {
    ctx.body = {
      code: 200,
      dataPool: await comment.getDataPool()
    }
  } catch (error) {
    ctx.body = {
      code: 1,
      dataPool: {}
    }
  }
})

module.exports = router
