# USDA verifies your code~

## Summary

USDA is a full stack web service to test projects in git repo and collect statistics, based on [gerrit](https://code.google.com/p/gerrit/)

- **Distributed Automation Testing** - USDA would calcurate dependency of different applications in one repo, and distribute tasks to multiple machine to run tests automatically

- **Gerrit Stats & Ranking** - a.k.a who merged/reviewed the most number for commits

## Setup

USDA contains 3 components: gerrit listener, usda server and usda slave(s)

**gerrit listener** pulls streaming-event from gerrit, listening to everything happened on gerrit.
* Start with:
```
node gerrit.js
```

**usda server** handles requests from gerrit listener and slaves, it also hosts the web entry point.
* Before start:
```
npm install
bower install
```
* Start with:
```
npm start
```

**usda slave(s)** could be deployed to multiple instances, taking tasks from server and executing them.
* Start with:
```
node your_repo_name_usda.js
```

## Usage
* control by gerrit comment. invoke test by "#test", boost a test in the queue by "boost"

* web interface presents:

  - The test queue for each repo, with estimated time
  - The time cost for each application
  - The boost usage of each user
  - The stats & ranking of overall & each individual repo.