if (!module.parent) {
  new require('./usda.js')({
    project: 'demo', // repo
    runners: [{
      app: 'appName',
      command: 'dummy_test'
    },
    {
      app: 'appName2',
      command: 'dummy_test'
    }],
    directory: 'your/path/to/repo/demo',
    logFile: 'demo_test.log',
    running: false
  }).start();
}