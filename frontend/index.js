// Copyright 2020 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const express = require('express');
const fileUpload = require('express-fileupload');
const Firestore = require('@google-cloud/firestore');
const {Storage} = require('@google-cloud/storage');
const storage = new Storage();
const path = require('path');
const dayjs = require('dayjs');
const relativeTime = require('dayjs/plugin/relativeTime');
dayjs.extend(relativeTime);

const { Client } = require('@elastic/elasticsearch');
const client = new Client({ 
    cloud: {
        id: process.env.ES_CLOUD_ID
    },
    auth: {
        apiKey: process.env.ES_API_KEY
    }
});

const app = express();
app.use(express.static('public'));
app.use(fileUpload({
    limits: { fileSize: 10 * 1024 * 1024 },
    useTempFiles : true,
    tempFileDir : '/tmp/'
}));

app.post('/api/pictures', async (req, res) => {
    if (!req.files || Object.keys(req.files).length === 0) {
        console.log("No file uploaded");
        return res.status(400).send('No file was uploaded.');
    }
    console.log(`Receiving file ${JSON.stringify(req.files.picture)}`);

    const newPicture = path.resolve('/tmp', req.files.picture.name);
    await req.files.picture.mv(newPicture);
    console.log('File moved in temporary directory');

    const pictureBucket = storage.bucket(process.env.BUCKET_PICTURES);
    await pictureBucket.upload(newPicture, { resumable: false });
    console.log("Uploaded new picture into Cloud Storage");

    res.redirect('/');
});

app.get('/api/pictures', async (req, res) => {
    console.log('Retrieving list of pictures');
    const pics = [];

    const query = req.query.q;
    console.log(`Query string: ${query}`);
    if (!!query) {
        // search query available -> query from ElasticSearch
        console.log(`Query requested: searching through ElasticSearch — query = ${query}`);

        try {
            const result = await client.search({
                query: {
                    match: { labels: query }
                }
            })
            console.log("Search result", result);

            console.log(result.hits.hits);
            result.hits.hits.forEach(hit => {
                pics.push({
                    name: hit._source.id,
                    labels: hit._source.labels,
                    color: hit._source.color,
                    created: dayjs(hit._source.created).fromNow()
                });
            });
        } catch(e) {
            console.log(e);
            console.error(e);
        }
    } else {
        // no search query -> return results from Firestore
        console.log("No query: searching through Firestore");
        const pictureStore = new Firestore().collection('pictures');
        const snapshot = await pictureStore
            .where('thumbnail', '==', true)
            .orderBy('created', 'desc').get();
    
        if (snapshot.empty) {
            console.log('No pictures found');
        } else {
            snapshot.forEach(doc => {
                const pic = doc.data();
                pics.push({
                    name: doc.id,
                    labels: pic.labels,
                    color: pic.color,
                    created: dayjs(pic.created.toDate()).fromNow()
                });
            });
        }
    }

    res.send(pics);
});

app.get('/api/pictures/:name', (req, res) => {
    res.redirect(`https://storage.googleapis.com/${process.env.BUCKET_PICTURES}/${req.params.name}`);
});

app.get('/api/thumbnails/:name', (req, res) => {
    res.redirect(`https://storage.googleapis.com/${process.env.BUCKET_THUMBNAILS}/${req.params.name}`);
});

app.get('/api/collage', (req, res) => {
    // Add timestamp to avoid Cloud Storage caching
    res.redirect(`https://storage.googleapis.com/${process.env.BUCKET_THUMBNAILS}/collage.png?${Date.now()}`);
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
    console.log(`Started web frontend service on port ${PORT}`);
    console.log(`- Pictures bucket = ${process.env.BUCKET_PICTURES}`);
    console.log(`- Thumbnails bucket = ${process.env.BUCKET_THUMBNAILS}`);
});
