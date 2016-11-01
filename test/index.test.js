'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');

const Serverless = require('serverless/lib/Serverless');
const AwsProvider = require('serverless/lib/plugins/aws/provider/awsProvider');
const BbPromise = require('bluebird');
const RollbackFunction = require('./../index');

describe('RollbackFunction', () => {
  let serverless;
  let rollbackFunction;

  beforeEach(() => {
    serverless = new Serverless();
    serverless.servicePath = true;
    serverless.service.environment = {
      vars: {},
      stages: {
        dev: {
          vars: {},
          regions: {
            'us-east-1': {
              vars: {},
            },
          },
        },
      },
    };
    serverless.service.functions = {
      hello: {
        handler: true,
      },
    };
    const options = {
      stage: 'dev',
      region: 'us-east-1',
      function: 'hello',
      functionObj: {
        name: 'hello',
      },
    };
    serverless.init();
    serverless.setProvider('aws', new AwsProvider(serverless));
    rollbackFunction = new RollbackFunction(serverless, options);
  });

  describe('#constructor()', () => {
    it('should have hooks', () => expect(rollbackFunction.hooks).to.be.not.empty);

    it('should set the provider variable to an instance of AwsProvider', () =>
      expect(rollbackFunction.provider).to.be.instanceof(AwsProvider));

    it('should set an empty options object if no options are given', () => {
      const rollbackFunctionWithEmptyOptions = new RollbackFunction(serverless);
      expect(rollbackFunctionWithEmptyOptions.options).to.deep.equal({});
    });

    it('should run promise chain in order to deploy', () => {
      const validateStub = sinon
        .stub(rollbackFunction, 'validate').returns(BbPromise.resolve());
      const publishVersionStub = sinon
        .stub(rollbackFunction, 'publishVersion').returns(BbPromise.resolve());
      const setAliasStub = sinon
        .stub(rollbackFunction, 'setAlias').returns(BbPromise.resolve());

      return rollbackFunction.hooks['before:deploy:function:deploy']().then(() => {
        expect(validateStub.calledOnce).to.equal(true);
        expect(publishVersionStub.calledAfter(validateStub))
          .to.equal(true);
        expect(setAliasStub.calledAfter(publishVersionStub))
          .to.equal(true);

        rollbackFunction.publishVersion.restore();
        rollbackFunction.setAlias.restore();
      });
    });

    it('should run promise chain in order to rollback', () => {
      const validateStub = sinon
        .stub(rollbackFunction, 'validate').returns(BbPromise.resolve());
      const getPreviousFunctionStub = sinon
        .stub(rollbackFunction, 'getPreviousFunction').returns(BbPromise.resolve());
      const restoreFunctionStub = sinon
        .stub(rollbackFunction, 'restoreFunction').returns(BbPromise.resolve());

      return rollbackFunction.hooks['rollback:function:rollback']().then(() => {
        expect(validateStub.calledOnce).to.equal(true);
        expect(getPreviousFunctionStub.calledAfter(validateStub))
          .to.equal(true);
        expect(restoreFunctionStub.calledAfter(getPreviousFunctionStub))
          .to.equal(true);

        rollbackFunction.getPreviousFunction.restore();
        rollbackFunction.restoreFunction.restore();
      });
    });
  });

  describe('getPreviousFunction()', () => {
    it('should get the previous function', () => {
      const getFunctionStub = sinon
        .stub(rollbackFunction.provider, 'request').returns(BbPromise.resolve());

      return rollbackFunction.getPreviousFunction().then(() => {
        expect(getFunctionStub.calledOnce).to.be.equal(true);
        expect(getFunctionStub.calledWithExactly(
          'Lambda',
          'getFunction',
          {
            FunctionName: 'aws-nodejs-dev-hello',
            Qualifier: 'aws-nodejs-dev-hello-rollback',
          },
          rollbackFunction.options.stage,
          rollbackFunction.options.region
        )).to.be.equal(true);
        rollbackFunction.provider.request.restore();
      });
    });
  });

  describe('restoreFunction()', () => {
    it('should restore the function', () => {
      const requestStub = sinon
        .stub(rollbackFunction, 'request').callsArgWith(1, null, null, 'foo');

      const updateFunctionCodeStub = sinon
        .stub(rollbackFunction.provider, 'request').returns(BbPromise.resolve());

      rollbackFunction.previousFunc = {
        Configuration: {
          CodeSize: 1024,
        },
        Code: {
          Location: 'http://example.com',
        },
      };

      return rollbackFunction.restoreFunction().then(() => {
        expect(requestStub.calledOnce).to.be.equal(true);
        expect(updateFunctionCodeStub.calledOnce).to.be.equal(true);
        expect(updateFunctionCodeStub.calledWithExactly(
          'Lambda',
          'updateFunctionCode',
          {
            FunctionName: 'aws-nodejs-dev-hello',
            ZipFile: 'foo',
          },
          rollbackFunction.options.stage,
          rollbackFunction.options.region
        )).to.be.equal(true);
        rollbackFunction.provider.request.restore();
      });
    });
  });

  describe('publishVersion()', () => {
    it('should publish a new version', () => {
      const publishVersionStub = sinon
        .stub(rollbackFunction.provider, 'request').returns(BbPromise.resolve({ Version: 10 }));

      return rollbackFunction.publishVersion().then(() => {
        expect(publishVersionStub.calledOnce).to.be.equal(true);
        expect(publishVersionStub.calledWithExactly(
          'Lambda',
          'publishVersion',
          {
            FunctionName: 'aws-nodejs-dev-hello',
          },
          rollbackFunction.options.stage,
          rollbackFunction.options.region
        )).to.be.equal(true);
        rollbackFunction.provider.request.restore();
      });
    });
  });

  describe('setAlias()', () => {
    it('should update the alias', () => {
      const setAliasStub = sinon
        .stub(rollbackFunction.provider, 'request').returns(BbPromise.resolve());

      rollbackFunction.newVersion = {
        Version: 10,
      };

      return rollbackFunction.setAlias().then(() => {
        expect(setAliasStub.calledOnce).to.be.equal(true);
        expect(setAliasStub.calledWithExactly(
          'Lambda',
          'updateAlias',
          {
            FunctionName: 'aws-nodejs-dev-hello',
            Name: 'aws-nodejs-dev-hello-rollback',
            FunctionVersion: 10,
          },
          rollbackFunction.options.stage,
          rollbackFunction.options.region
        )).to.be.equal(true);
        rollbackFunction.provider.request.restore();
      });
    });

    it('should create the alias', () => {
      const setAliasStub = sinon
        .stub(rollbackFunction.provider, 'request').returns(BbPromise.resolve());

      setAliasStub.withArgs(
        'Lambda',
        'updateAlias',
        {
          FunctionName: 'aws-nodejs-dev-hello',
          Name: 'aws-nodejs-dev-hello-rollback',
          FunctionVersion: 10,
        },
        rollbackFunction.options.stage,
        rollbackFunction.options.region)
      .returns(BbPromise.reject(new Error('test')));

      rollbackFunction.newVersion = {
        Version: 10,
      };

      return rollbackFunction.setAlias().then(() => {
        expect(setAliasStub.calledTwice).to.be.equal(true);
        expect(setAliasStub.calledWithExactly(
          'Lambda',
          'createAlias',
          {
            FunctionName: 'aws-nodejs-dev-hello',
            Name: 'aws-nodejs-dev-hello-rollback',
            FunctionVersion: 10,
          },
          rollbackFunction.options.stage,
          rollbackFunction.options.region
        )).to.be.equal(true);
        rollbackFunction.provider.request.restore();
      });
    });
  });
});
