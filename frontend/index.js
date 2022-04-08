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

    console.log("Full query", req.query);

    // req.query returns either an array for multiple query params, or a string for a single query param
    const labels = req.query.l ? (Array.isArray(req.query.l) ? [...req.query.l] : [req.query.l]) : [];
    const objects = req.query.o ? (Array.isArray(req.query.o) ? [...req.query.o] : [req.query.o]) : [];

    const colors = req.query.c ? (Array.isArray(req.query.c) ? [...req.query.c].map(c => hex2color(c)) : [hex2color(req.query.c)]) : [];

    let queryPart = {};
    if (!!req.query.q) {
        queryPart = { 
            must: [
                {
                    multi_match: {
                        query: req.query.q,
                        fields: [
                            "landmark.name",
                            "labels",
                            "objects",
                            "text"
                        ],
                        fuzziness: "auto"
                    }
                }
            ]
        };
    }

    let colorsPart = [];
    if (colors.length > 0) {
        const THRESHOLD = 20;
        const c1 = colors[0];
        /*
        // start working on multi-color search
        colors.map(c => { 
            return {
                range: {
                    "colors.red": {
                        gte: c.red - THRESHOLD,
                        lte: c.red + THRESHOLD
                    }
                }
            },
            {
                range: {
                    "colors.blue": {
                        gte: c.blue - THRESHOLD,
                        lte: c.blue + THRESHOLD
                    }
                }
            },
            {
                range: {
                    "colors.green": {
                        gte: c.green - THRESHOLD,
                        lte: c.green + THRESHOLD
                    }
                }
            }
        });
        */
        colorsPart = [
            {
                nested: {
                    path: "colors",
                    query: {
                        bool: {
                            filter: [
                                {
                                    range: {
                                        "colors.red": {
                                            gte: c1.red - THRESHOLD,
                                            lte: c1.red + THRESHOLD
                                        }
                                    }
                                },
                                {
                                    range: {
                                        "colors.blue": {
                                            gte: c1.blue - THRESHOLD,
                                            lte: c1.blue + THRESHOLD
                                        }
                                    }
                                },
                                {
                                    range: {
                                        "colors.green": {
                                            gte: c1.green - THRESHOLD,
                                            lte: c1.green + THRESHOLD
                                        }
                                    }
                                }
                            ]
                        }
                    }
                }
            }
        ];
    }

    const esQuery = {
        index: 'pixxearch',
        size: 40,
        query: {
          bool: {
            ...queryPart,
            filter: [
                ...colorsPart,
                ...(labels.map(l => { return {term: {"labels.keyword": l}}})),
                ...(objects.map(o => { return {term: {"objects.keyword": o}}}))
            ]
          }
        },
        sort: [
          "_score",
          {
            created: {
              order: "desc"
            }
          }
        ]
      };
      
    console.log("ElasticSearch query", JSON.stringify(esQuery, null, '  '));

    try {
        const result = await client.search(esQuery);

        console.log(`Returning ${result.hits.hits.length} results`);
        result.hits.hits.forEach(hit => {
            pics.push({
                name: hit._source.name,
                labels: hit._source.labels,
                objects: [...new Set(hit._source.objects)],
                color: `rgb(${hit._source.colors[0].red}, ${hit._source.colors[0].green}, ${hit._source.colors[0].blue})`,
                colors: hit._source.colors,
                created: dayjs(hit._source.created).fromNow()
            });
        });
    } catch(e) {
        console.log(e);
        console.error(e);
    }

    res.send(pics);
});

function hex2color(hexColorStr) {
    return {
        red: parseInt(hexColorStr.slice(1, 3), 16),
        green: parseInt(hexColorStr.slice(3, 5), 16),
        blue: parseInt(hexColorStr.slice(5, 7), 16)
    }
}

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
