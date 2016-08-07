const appinsights = require('applicationinsights'),
    arxiv = require('./arxivQuery'),
    azure = require('azure-storage'),
    azsearch = require('azure-search'),
    builder = require('botbuilder'),
    restify = require('restify'),
    util = require('util');

//=========================================================
// Bot Setup
//=========================================================
var model = process.env.LUIS_MODEL_URI;
var recognizer = new builder.LuisRecognizer(model);

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});

// Create chat bot
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});
var bot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());
server.get(/.*/, restify.serveStatic({
    'directory': __dirname,
    'default': 'ping.html'
}));

//=========================================================
// Bots Dialogs
//=========================================================

function cardForPaper(session, paper) {
    var paperCard = new builder.HeroCard(session);
    paperCard.title = paper.title;
    paperCard.subtitle = util.format(' || ID: %s, Version: %s, Published: %s || ', paper.id, paper.version, paper.pubdate);
    paperCard.text = util.format('# [%s](%s)\n%s', paper.title, paper.uri, paper.summary);
    paperCard.tap = builder.CardAction.openUrl(session, paper.uri);
    paperCard.images = [builder.CardImage.create(session, 'https://milanzarxiv.azurewebsites.net/pdf_icon.png')];
    return paperCard;
}

var dialog = new builder.IntentDialog({recognizers: [recognizer]});
bot.dialog('/', dialog);
dialog.matches('add-interest', [
    function (session, args, next) {
        console.log('add-interest:');
        console.log(args.entities);
        var interests = builder.EntityRecognizer.findAllEntities(args.entities, 'interest');
        if (!interests) {
            builder.Prompts.text(session, 'What interest did you want to add?');
        } else {
            next({ response: interests.map(function (elt) { return elt.entity; }) });
        }
    },
    function (session, results) {
        if (results.response) {
            session.send('OK, added interests "%s".', results.response.join('", "'));
            if (!session.userData.interests) {
                session.userData.interests = []
            }
            session.userData.interests = session.userData.interests.concat(results.response);
            session.send('Current interests: "%s".', session.userData.interests.join('", "'));
        } else {
            session.send('Alrighty, then.');
        }
    }
]);
dialog.matches('find-papers', [
    function (session, args, next) {
        console.log('find-papers:');
        console.log(args.entities);
        var interests = builder.EntityRecognizer.findAllEntities(args.entities, 'interest');
        if (!interests) {
            if (session.userData.interests) {
                next({ response: session.userData.interests });
            } else {
                builder.Prompts.text(session, 'What interest did you want to search for?');
            }
        } else {
            next({ response: interests.map(function (elt) { return elt.entity; }) });
        }
    },
    function (session, results) {
        if (results.response) {
            var interests = results.response;
            if (!(interests instanceof Array)) {
                interests = [ interests ];
            }
            session.send('Great, searching for papers on "%s"', interests.join('", "'));
            arxiv.queryArxiv(interests, 5).then(function (papers) {
                papers.forEach(function (paper) {
                   console.log('Found: ' + paper.title);
                   session.send(cardForPaper(session, paper));
                });
            }).catch(function (err) {
                session.send('Error fetching papers: ' + err);
            })
        } else {
            session.send('Alrighty, then.');
        }
    }
]);
dialog.onDefault(builder.DialogAction.send("I'm sorry I didn't understand."));