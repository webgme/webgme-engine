/*globals requirejs, expect*/
/*eslint-env browser, mocha*/
/**
 * @author lattmann / https://github.com/lattmann
 */

describe('API access from webbrowser', function () {
    'use strict';

    var superagent = null;

    before(function (done) {
        this.timeout(10000);
        requirejs(['superagent'], function (superagent_) {

            superagent = superagent_;

            superagent.get('/base/gmeConfig.json')
                .end(function (err, res) {
                    expect(err).to.equal(null);

                    expect(res.status).to.equal(200);
                    //console.log(res.body);

                    done();
                });
        });
    });

    it('should get source code documentation link', function (done) {
        superagent.get('/api').end(function (err, res) {
            expect(res.status).equal(200, err);
            expect(Object.hasOwn(res.body, 'source_code_documentation_url')).to.equal(true);
            superagent.get(res.body.source_code_documentation_url).end(function (err, res) {
                expect(res.status).equal(200, err);
                done();
            });
        });
    });
});
