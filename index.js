'use strict';

const BbPromise = require('bluebird');
const validate = require('serverless/lib/plugins/aws/lib/validate');
const request = require('request');
const bytes = require('bytes');

class FunctionRollback {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options || {};
    this.provider = this.serverless.getProvider('aws');
    this.request = request;

    Object.assign(this, validate);

    this.commands = {
      rollback: {
        commands: {
          function: {
            usage: 'Rollback the function to the previous version',
            lifecycleEvents: [
              'rollback',
            ],
            options: {
              function: {
                usage: 'Name of the function',
                shortcut: 'f',
                required: true,
              },
              stage: {
                usage: 'Stage of the function',
                shortcut: 's',
              },
              region: {
                usage: 'Region of the function',
                shortcut: 'r',
              },
            },
          },
        },
      },
    };

    this.hooks = {
      'before:deploy:function:deploy': () => BbPromise.bind(this)
        .then(this.validate)
        .then(this.publishVersion)
        .then(this.setAlias),
      'rollback:function:rollback': () => BbPromise.bind(this)
        .then(this.validate)
        .then(this.getPreviousFunction)
        .then(this.restoreFunction),
    };
  }

  getPreviousFunction() {
    this.serverless.cli.log(`Rollbacking function: ${this.options.function}...`);
    this.options.functionObj = this.serverless.service.getFunction(this.options.function);

    const params = {
      FunctionName: this.options.functionObj.name,
      Qualifier: `${this.options.functionObj.name}-rollback`,
    };

    return this.provider.request(
      'Lambda',
      'getFunction',
      params,
      this.options.stage, this.options.region
    ).then((ret) => {
      this.previousFunc = ret;
    });
  }

  restoreFunction() {
    this.serverless.cli.log(
      `Uploading function: ${this.options.function} (${bytes(this.previousFunc.Configuration.CodeSize)})...`
    );
    this.options.functionObj = this.serverless.service.getFunction(this.options.function);

    const options = {
      method: 'GET',
      url: this.previousFunc.Code.Location,
      encoding: null,
    };

    this.request(options, (err, res, body) => {
      const params = {
        FunctionName: this.options.functionObj.name,
        ZipFile: body,
      };
      this.serverless.cli.log(params.FunctionName);

      this.provider.request(
        'Lambda',
        'updateFunctionCode',
        params,
        this.options.stage, this.options.region
      ).then(() => {
        this.serverless.cli.log(`Successfully rollbacked function: ${this.options.function}`);
      });
    });

    return BbPromise.resolve();
  }

  publishVersion() {
    this.options.functionObj = this.serverless.service.getFunction(this.options.function);

    const params = {
      FunctionName: this.options.functionObj.name,
    };

    return this.provider.request(
      'Lambda',
      'publishVersion',
      params,
      this.options.stage, this.options.region
    ).then((ret) => {
      this.serverless.cli.log(`Publish the new version: ${ret.Version}`);
      this.newVersion = ret;
    });
  }

  setAlias() {
    this.options.functionObj = this.serverless.service.getFunction(this.options.function);

    const aliasName = `${this.options.functionObj.name}-rollback`;
    const beforeVersion = this.newVersion.Version;
    const params = {
      FunctionName: this.options.functionObj.name,
      Name: aliasName,
      FunctionVersion: beforeVersion,
    };

    return this.provider.request(
      'Lambda',
      'updateAlias',
      params,
      this.options.stage, this.options.region
    ).then(() => {
      this.serverless.cli.log(`Update the alias: ${aliasName} = ${beforeVersion}`);
    }).catch(() => {
      this.provider.request(
        'Lambda',
        'createAlias',
        params,
        this.options.stage, this.options.region
      ).then(() => {
        this.serverless.cli.log(`Create the new alias: ${aliasName} = ${beforeVersion}`);
      });
    });
  }


}

module.exports = FunctionRollback;
