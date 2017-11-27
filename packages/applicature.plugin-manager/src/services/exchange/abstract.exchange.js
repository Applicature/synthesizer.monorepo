const MultivestError = require('../../error');

class AbstractExchange {
// eslint-disable-next-line class-methods-use-this,no-unused-vars
    getRate(value, from, to) {
        throw new MultivestError('not-implemented');
    }
}

module.exports = AbstractExchange;
