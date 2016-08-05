const feedparser = require('feedparser'),
    request = require('request'),
    util = require('util'),
    _Promise = require('bluebird');

const baseArxivUri = 'http://export.arxiv.org/api/query?search_query=%s&sortBy=lastUpdatedDate&start=%d&max_results=%d';
const defaultQuery = 'cat:cs.CV+OR+cat:cs.AI+OR+cat:cs.LG+OR+cat:cs.CL+OR+cat:cs.NE+OR+cat:stat.ML'; // From arXiv Sanity Preserver
function queryArxiv(interests, numResults) {
    return new Promise(function (resolve, reject) {
        var query = interests ? util.format('(%s) AND (%s)', defaultQuery, interests.join(' OR ')) : defaultQuery;
        var uri = util.format(baseArxivUri, query, 0, numResults || 3);
        console.log('Calling ' + uri);
        var req = request(uri),
            parser = new feedparser();

        req.on('error', function (error) {
            reject(error);
        });
        req.on('response', function (res) {
            var stream = this;

            if (res.statusCode != 200) reject(new Error('Bad status code: ' + res.statusCode));

            stream.pipe(parser);
        });

        var papers = [];
        var idx = 1;
        parser.on('error', function (error) {
            reject(error);
        });
        parser.on('readable', function () {
            // This is where the action is!
            var stream = this
                , meta = this.meta // **NOTE** the "meta" is always available in the context of the feedparser instance
                , item;

            while (item = stream.read()) {
                console.log(util.format('Item %d: %s', idx++, item.link));
                var paper = {
                    uri: item.link,
                    pubdate: item.pubdate,
                    title: item.title.replace(/\s+/g, ' '),
                    summary: item.summary.replace(/\s+/g, ' '),
                    categories: item.categories
                };
                var idAndVersion = paper.uri.substring(paper.uri.lastIndexOf('/')+1).split('v');
                paper.id = idAndVersion[0];
                paper.version = idAndVersion[1];
                papers.push(paper);
            }
        });
        parser.on('end', function () {
            resolve(papers);
        })
    });
}

module.exports = {
    queryArxiv: queryArxiv
};
