#!/usr/bin/env node
const http = require('http').createServer();
const yargs = require('yargs')
const process = require('process')
const DiffMatchPatch = require('diff-match-patch')
const { io } = require("socket.io-client");
const inquirer = require('inquirer');
const fs = require('fs');
const md5 = require('md5');
const GbSdk = require('./src/gb-sdk');
const { Console } = require('console');
const dmp = new DiffMatchPatch();
// let url = 'http://localhost:3000/auth/login';

// let options = {
//   method: 'POST',
//   headers: {
//     'Content-Type': 'application/json',
//     // cookie: 'jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJsY2ciLCJpYXQiOjE2NTY5Nzg2ODksImV4cCI6MTY1Nzg0MjY4OX0.p-Funvr26v0YtaGoJdmFG_htM98RlVczBNpH_Ei3lF0; '
//   },
//   body: '{"email":"lcg","password":"123"}'
// };

// fetch(url, options)
//   .then(res => {
//     console.log(res.headers.get('set-cookie'));
//     return res.json();
//   })
//   .then(json => {
//     // console.log(json)
//   })
//   .catch(err => console.error('error:' + err));

// url = 'http://localhost:3000/docker/container/list';

// options = {
//   method: 'GET',
//   headers: {
//     cookie: 'jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJsY2ciLCJpYXQiOjE2NTg0MjM2MDUsImV4cCI6MTY1OTI4NzYwNX0.Za1Nc99vhmfoQ3Ygv11Oben_Cy-juLabgj9LYqZXatE; '
//   }
// };

// fetch(url, options)
//   .then(res => res.json())
//   .then(json => console.log(json))
//   .catch(err => console.error('error:' + err));
// let md5Previous = null;
// let filePrevious = 'teste';
// let fsWait = false;
// fs.watch('teste.js', (event, filename) => {
//   if (filename) {
//     // if (fsWait) return;
//     // fsWait = setTimeout(() => {
//     //   fsWait = false;
//     // }, 20);
//     console.log(`P: ${filePrevious}`)
//     const file = fs.readFileSync('teste.js', { encoding: 'utf8' },
//       function (err, data) {
//         if (err) {
//           console.log(err);
//         }
//       }
//     );
//     console.log(`P: ${filePrevious} | N: ${file}`)

//     // const md5Current = md5(file);
//     // if (md5Current === md5Previous) {
//     //   return;
//     // }
//     const diff = dmp.diff_main(filePrevious, file);
//     dmp.diff_cleanupSemantic(diff);
//     const rplArr = []
//     console.log(diff)
//     console.log(dmp.patch_apply(dmp.patch_make(diff), filePrevious))

//     // md5Previous = md5Current;
//     filePrevious = file;
//     console.log(`${filename} file Changed`);
//   }
// });

const stdin = process.stdin;

let socket = null;

const arg = (name, type = 'string') => ({
  describe: name,
  demandOption: true, 
  type     
})
const optArg = (name, type = 'string') => ({
  describe: name,
  demandOption: false, 
  type     
})



let password = null;
let key = null;
yargs.version('0.0.1')
yargs
  .command({
    command: 'setup',
    describe: 'Setup Variables',
    builder: {
      url: optArg('API Url'),
      user: arg('Usuário'),
    },
    handler: (argv) => {
      const {user, url} = argv

      const fileData = fs.readFileSync('users.json', { encoding: 'utf8' });
      const map = JSON.parse(fileData);
      map[user] = {
        url: url || 'http://localhost:'
      }
      
      fs.writeFileSync('users.json', JSON.stringify(map));
      console.log("Writed")
    }
  })
  .command({
    command: 'login',
    describe: 'Login',
    builder: {
        user: arg('Usuário'),
        password: arg('Senha')
    },
    handler: (argv) => {
      const {user, password} = argv
      console.log("Result: ", user, password)
    }
  })
  .command({
    command: 'connect',
    describe: 'Connect to API',
    builder: {
        file: arg('File'),
    },
    handler: async (argv) => {
      
      const { file } = argv;
      const fileData = fs.readFileSync(file, { encoding: 'utf8' });
      console.log(fileData);
      const user = await askUser();
      const password = await askPassword();

      const sdk = new GbSdk(user.url);
      key = await sdk.login(user.email, password);

      const container = await sdk
        .listContainers(key)
        .then(askContainer);

      socket = io(`${user.url}80`, { transports: ["websocket"] })
      
      socket.emit('start', {
        key,
        fileData,
        containerId: container.id
      })
      socket.on("terminal-output", ({ data }) => {
        process.stdout.write(data)
      });
      stdin.on('data', (data) => {
        if (socket)
          socket.emit("terminal-input", {data});
      })
      stdin.on('readable', (data) => {
        let chunk;
        while ((chunk = process.stdin.read()) !== null){}
      })
    }
  })

  .help()
  .alias('help', 'h').argv;



async function askPassword() {
  const answers = await inquirer.prompt({
    name: 'password',
    type: 'password',
    message: 'Password',
  });

  return answers.password;
}


async function askUser() {
  const fileData = fs.readFileSync('users.json', { encoding: 'utf8' });
  const map = JSON.parse(fileData);
  const answers = await inquirer.prompt({
    name: 'user',
    type: 'list',
    message: 'Select an user',
    choices: Object.keys(map).map(value => ({
      name: value,
      value: {
        email: value,
        ...map[value]
      },
    }))
  });

  return answers.user;
}

async function askContainer(containerlist) {
  const answers = await inquirer.prompt({
    name: 'container',
    type: 'list',
    message: 'Select an container',
    choices: containerlist.reverse().map((x) => ({
      name: `${x.name} | Image:${x.image}`,
      value: {
        id: x.id,
        containerRefId: x.containerRefId
      }
    }))
  });

  return answers.container;
}



