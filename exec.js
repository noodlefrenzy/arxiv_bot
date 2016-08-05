const q = require('./arxivQuery');

q.queryArxiv(['mcmc']).then(function (papers) {
    papers.forEach(function (paper) { console.log(paper); });
    console.log('Done');
}).catch(function (err) {
    console.error(err);
});
