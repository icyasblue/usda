var config = {
  gerrit: {
    hostname: 'your_gerrit_server_host',
    port: 'your_gerrit_server_port',
    username: 'your_gerrit_username' // make sure your ssh key is set up correctly
  },
  usdaServer: {
    hostname: 'localhost',
    port: '3000'
  },
  projects: {
    repoName: {
      appName: [ // watching folders
              'appName/src/'
            ],
    },
    repoName2: {
      appName2: [
                'appName2/src/'
            ]
    }
  },

  message: {
    appName: {
      pass: 'The USDA says this appName is \"Grade A Certified!\"\n\n',
      fail: 'Oh no, not again...\n\n'
    }
  }
};

module.exports = config;
