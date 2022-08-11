const fetch = require('node-fetch');

class GbSdk {
  constructor(url) {
    this.baseUrl = url;
    this.url = `${url}3000`
  }
  buildUrl(path) {
    return `${this.url}${path}`
  }
  async login(email, password) {
    let url = this.buildUrl('/auth/login');

    const body = {
      email,
      password
    }
    const data = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=utf-8'
      },
      body: JSON.stringify(body)
    })
    if (data.status >= 400) {
      throw new Error("Error in request");
    }
    const [key] = data.headers
      .get('set-cookie')
      .replace('jwt=', '')
      .split(';')
    
    return key;
  }

  async listContainers(key) {
    let url = this.buildUrl('/docker/container/list');

  
    const data = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json;charset=utf-8',
        cookie: `jwt=${key}; `
      },
    })
    if (data.status >= 400) {
      throw new Error("Error in request");
    }
    
    
    return data.json();
  }
}
module.exports = GbSdk