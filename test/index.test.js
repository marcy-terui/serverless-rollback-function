'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');

const Serverless = require('serverless/lib/Serverless');
const AwsProvider = require('serverless/lib/plugins/aws/provider/awsProvider');
const BbPromise = require('bluebird');
const FunctionRollback = require('./../index');

describe('FunctionRollback', () => {
  let serverless;
  let functionRollback;

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
    functionRollback = new FunctionRollback(serverless, options);
  });

  describe('#constructor()', () => {
    it('should have hooks', () => expect(functionRollback.hooks).to.be.not.empty);

    it('should set the provider variable to an instance of AwsProvider', () =>
      expect(functionRollback.provider).to.be.instanceof(AwsProvider));

    it('should set an empty options object if no options are given', () => {
      const functionRollbackWithEmptyOptions = new FunctionRollback(serverless);
      expect(functionRollbackWithEmptyOptions.options).to.deep.equal({});
    });

    it('should run promise chain in order to deploy', () => {
      const validateStub = sinon
        .stub(functionRollback, 'validate').returns(BbPromise.resolve());
      const publishVersionStub = sinon
        .stub(functionRollback, 'publishVersion').returns(BbPromise.resolve());
      const setAliasStub = sinon
        .stub(functionRollback, 'setAlias').returns(BbPromise.resolve());

      return functionRollback.hooks['before:deploy:function:deploy']().then(() => {
        expect(validateStub.calledOnce).to.equal(true);
        expect(publishVersionStub.calledAfter(validateStub))
          .to.equal(true);
        expect(setAliasStub.calledAfter(publishVersionStub))
          .to.equal(true);

        functionRollback.publishVersion.restore();
        functionRollback.setAlias.restore();
      });
    });

    it('should run promise chain in order to rollback', () => {
      const validateStub = sinon
        .stub(functionRollback, 'validate').returns(BbPromise.resolve());
      const getPreviousFunctionStub = sinon
        .stub(functionRollback, 'getPreviousFunction').returns(BbPromise.resolve());
      const restoreFunctionStub = sinon
        .stub(functionRollback, 'restoreFunction').returns(BbPromise.resolve());

      return functionRollback.hooks['rollback:function:rollback']().then(() => {
        expect(validateStub.calledOnce).to.equal(true);
        expect(getPreviousFunctionStub.calledAfter(validateStub))
          .to.equal(true);
        expect(restoreFunctionStub.calledAfter(getPreviousFunctionStub))
          .to.equal(true);

        functionRollback.getPreviousFunction.restore();
        functionRollback.restoreFunction.restore();
      });
    });
  });

  describe('getPreviousFunction()', () => {
    it('should get the previous function', () => {
      const getFunctionStub = sinon
        .stub(functionRollback.provider, 'request').returns(BbPromise.resolve());

      return functionRollback.getPreviousFunction().then(() => {
        expect(getFunctionStub.calledOnce).to.be.equal(true);
        expect(getFunctionStub.calledWithExactly(
          'Lambda',
          'getFunction',
          {
            FunctionName: 'aws-nodejs-dev-hello',
            Qualifier: 'aws-nodejs-dev-hello-rollback',
          },
          functionRollback.options.stage,
          functionRollback.options.region
        )).to.be.equal(true);
        functionRollback.provider.request.restore();
      });
    });
  });

  describe('restoreFunction()', () => {
    it('should restore the function', () => {
      const requestStub = sinon
        .stub(functionRollback, 'request').callsArgWith(1, null, null, 'foo');

      const updateFunctionCodeStub = sinon
        .stub(functionRollback.provider, 'request').returns(BbPromise.resolve());

      functionRollback.previousFunc = {
        Configuration: {
          CodeSize: 1024,
        },
        Code: {
          Location: 'http://example.com',
        },
      };

      return functionRollback.restoreFunction().then(() => {
        expect(requestStub.calledOnce).to.be.equal(true);
        expect(updateFunctionCodeStub.calledOnce).to.be.equal(true);
        expect(updateFunctionCodeStub.calledWithExactly(
          'Lambda',
          'updateFunctionCode',
          {
            FunctionName: 'aws-nodejs-dev-hello',
            ZipFile: 'foo',
          },
          functionRollback.options.stage,
          functionRollback.options.region
        )).to.be.equal(true);
        functionRollback.provider.request.restore();
      });
    });
  });

  describe('publishVersion()', () => {
    it('should publish a new version', () => {
      const publishVersionStub = sinon
        .stub(functionRollback.provider, 'request').returns(BbPromise.resolve({ Version: 10 }));

      return functionRollback.publishVersion().then(() => {
        expect(publishVersionStub.calledOnce).to.be.equal(true);
        expect(publishVersionStub.calledWithExactly(
          'Lambda',
          'publishVersion',
          {
            FunctionName: 'aws-nodejs-dev-hello',
          },
          functionRollback.options.stage,
          functionRollback.options.region
        )).to.be.equal(true);
        functionRollback.provider.request.restore();
      });
    });
  });

  describe('setAlias()', () => {
    it('should update the alias', () => {
      const setAliasStub = sinon
        .stub(functionRollback.provider, 'request').returns(BbPromise.resolve());

      functionRollback.newVersion = {
        Version: 10,
      };

      return functionRollback.setAlias().then(() => {
        expect(setAliasStub.calledOnce).to.be.equal(true);
        expect(setAliasStub.calledWithExactly(
          'Lambda',
          'updateAlias',
          {
            FunctionName: 'aws-nodejs-dev-hello',
            Name: 'aws-nodejs-dev-hello-rollback',
            FunctionVersion: 10,
          },
          functionRollback.options.stage,
          functionRollback.options.region
        )).to.be.equal(true);
        functionRollback.provider.request.restore();
      });
    });

    it('should create the alias', () => {
      const setAliasStub = sinon
        .stub(functionRollback.provider, 'request').returns(BbPromise.resolve());

      setAliasStub.withArgs(
        'Lambda',
        'updateAlias',
        {
          FunctionName: 'aws-nodejs-dev-hello',
          Name: 'aws-nodejs-dev-hello-rollback',
          FunctionVersion: 10,
        },
        functionRollback.options.stage,
        functionRollback.options.region)
      .returns(BbPromise.reject(new Error('test')));

      functionRollback.newVersion = {
        Version: 10,
      };

      return functionRollback.setAlias().then(() => {
        expect(setAliasStub.calledTwice).to.be.equal(true);
        expect(setAliasStub.calledWithExactly(
          'Lambda',
          'createAlias',
          {
            FunctionName: 'aws-nodejs-dev-hello',
            Name: 'aws-nodejs-dev-hello-rollback',
            FunctionVersion: 10,
          },
          functionRollback.options.stage,
          functionRollback.options.region
        )).to.be.equal(true);
        functionRollback.provider.request.restore();
      });
    });
  });
});
