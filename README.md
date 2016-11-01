serverless-rollback-function
=======

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![Build Status](https://travis-ci.org/marcy-terui/serverless-rollback-function.svg?branch=master)](https://travis-ci.org/marcy-terui/serverless-rollback-function)
[![Coverage Status](https://coveralls.io/repos/github/marcy-terui/serverless-rollback-function/badge.svg?branch=master)](https://coveralls.io/github/marcy-terui/serverless-rollback-function?branch=master)

# Description

A Serverless Framework Plugin to rollback the single function.

# Requirements

- [Serverless Framework](https://github.com/serverless/serverless) 1.0 or higher

# Installation

```sh
npm install serverless-rollback-function
```

# Configuration

### serverless.yml

```yaml
plugins:
  - serverless-rollback-function
```

# Usage

## Deploy the single function

```sh
serverless deploy function -f $FUNCTION_NAME
```

## Rollback the single function

```sh
serverless rollback function -f $FUNCTION_NAME
```

Development
-----------

-   Source hosted at [GitHub](https://github.com/marcy-terui/serverless-rollback-function)
-   Report issues/questions/feature requests on [GitHub
    Issues](https://github.com/marcy-terui/serverless-rollback-function/issues)

Pull requests are very welcome! Make sure your patches are well tested.
Ideally create a topic branch for every separate change you make. For
example:

1.  Fork the repo
2.  Create your feature branch (`git checkout -b my-new-feature`)
3.  Commit your changes (`git commit -am 'Added some feature'`)
4.  Push to the branch (`git push origin my-new-feature`)
5.  Create new Pull Request

Authors
-------

Created and maintained by [Masashi Terui](https://github.com/marcy-terui) (<marcy9114@gmail.com>)

License
-------

MIT License (see [LICENSE](https://github.com/marcy-terui/serverless-rollback-function/blob/master/LICENSE.txt))
