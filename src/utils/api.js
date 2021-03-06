import wepy from 'wepy'

// 服务器接口地址
const host = 'http://laravel-wm-server.test/api'

// 普通请求
const request = async (options, showLoading = true) => {
  // 简化开发，如果传入字符串则转换成 对象
  if (typeof options === 'string') {
    options = {
      url: options
    }
  }
  // 显示加载中
  if (showLoading) {
    wepy.showLoading({title: '加载中'})
  }
  // 拼接请求地址
  options.url = host + '/' + options.url
  // 调用小程序的 request 方法
  let response = await wepy.request(options)

  if (showLoading) {
    // 隐藏加载中
    wepy.hideLoading()
  }

  // 服务器异常后给与提示
  if (response.statusCode === 500) {
    if (response.data.message.search("Integrity constraint violation") !== -1) {
      wepy.showToast({
        title: '失败(数据关联)',
        image: '/images/error.png',
        duration: 2000
      })
    } else {
      wepy.showModal({
        title: '提示',
        content: '服务器错误，请联系管理员'
      })
    }


  }
  if (response.statusCode === 429) {
    wepy.showModal({
      title: '提示',
      content: '您的操作过于频繁，请稍后再试'
    })
  }
  return response
}

// 登录
const login = async (params = {}) => {
  // code 只能使用一次，所以每次单独调用
  let loginData = await wepy.login()
  params.code = loginData.code

  // 接口请求 weapp/authorizations
  let authResponse = await request({
    url: 'weapp/authorizations',
    data: params,
    method: 'POST'
  })

  // 登录成功，记录 token 信息
  if (authResponse.statusCode === 201) {
    wepy.setStorageSync('access_token', authResponse.data.meta.access_token)
    wepy.setStorageSync('access_token_expired_at', new Date().getTime() + authResponse.data.meta.expires_in * 1000)
  }

  return authResponse
}

const register = async (params = {}) => {
  // code 只能使用一次，所以每次单独调用
  let loginData = await wepy.login()
  params.code = loginData.code
  // 接口请求 weapp/register
  let authResponse = await request({
    url: 'weapp/register',
    data: params,
    method: 'POST'
  })

  // 登录成功，记录 token 信息
  if (authResponse.statusCode === 201) {
    wepy.setStorageSync('access_token', authResponse.data.meta.access_token)
    wepy.setStorageSync('access_token_expired_at', new Date().getTime() + authResponse.data.meta.expires_in * 1000)
  }

  return authResponse
}


// 刷新 Token
const refreshToken = async (accessToken) => {
  // 请求刷新接口
  let refreshResponse = await wepy.request({
    url: host + '/' + 'authorizations/current',
    method: 'PUT',
    header: {
      'Authorization': 'Bearer ' + accessToken
    }
  })

  // 刷新成功状态码为 200
  if (refreshResponse.statusCode === 200) {
    // 将 Token 及过期时间保存在 storage 中
    wepy.setStorageSync('access_token', refreshResponse.data.access_token)
    wepy.setStorageSync('access_token_expired_at', new Date().getTime() + refreshResponse.data.expires_in * 1000)
  }

  return refreshResponse
}

// 获取 Token
const getToken = async (options) => {
  // 从缓存中取出 Token
  let accessToken = wepy.getStorageSync('access_token')
  let expiredAt = wepy.getStorageSync('access_token_expired_at')
  let loginParams = wepy.getStorageSync('loginParams')

  // 如果 token 过期了，则调用刷新方法
  if (accessToken && new Date().getTime() > expiredAt) {
    let refreshResponse = await refreshToken(accessToken)

    // 刷新成功
    if (refreshResponse.statusCode === 200) {
      accessToken = refreshResponse.data.access_token
    } else {
        if (loginParams) {
          let authResponse = await login(loginParams)
          if (authResponse.statusCode === 201) {
            accessToken = authResponse.data.meta.access_token
          }
        }
    }
  }
  return accessToken
}

// 带身份认证的请求
const authRequest = async (options, showLoading = true) => {
  if (typeof options === 'string') {
    options = {
      url: options
    }
  }
  // 获取Token
  let accessToken = await getToken()

  // 将 Token 设置在 header 中
  let header = options.header || {}
  header.Authorization = 'Bearer ' + accessToken
  options.header = header

  return request(options, showLoading)
}

//  退出登录
const logout = async (params = {}) => {
  // 调用删除 Token 接口，让 Token 失效
  let logoutResponse = await authRequest({
    url: 'authorizations/current',
    method: 'DELETE'
  })

  // 调用接口成功则清空缓存
  if (logoutResponse.statusCode === 204) {
    wepy.clearStorage()
  }

  return logoutResponse
}

export default {
  request,
  authRequest,
  refreshToken,
  login,
  register,
  logout
}
