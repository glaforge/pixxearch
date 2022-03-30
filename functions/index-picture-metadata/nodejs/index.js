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

const fetch = require("node-fetch");

const ELASTICSEARCH_ENDPOINT = process.env.ELASTICSEARCH_ENDPOINT;
const ELASTICSEARCH_PRIVATE_KEY = process.env.ELASTICSEARCH_PRIVATE_KEY;

exports.indexPictureMetadata = async (req, res) => {
  const pictureMetadata = req.body;
  const id = req.query.id;
  pictureMetadata.id = id;
  pictureMetadata.labels = pictureMetadata.labels.map(entry => entry.stringValue );

  console.log("Indexing picture metadata", pictureMetadata);

  try {
    const esResp = await fetch(ELASTICSEARCH_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify(pictureMetadata),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ELASTICSEARCH_PRIVATE_KEY}`
      }
    });
    const esRespJson = await esResp.json();
    console.log("ElasticSearch outcome", esRespJson);
    
    res.status(200).send({"indexed": true});
    return;
  } catch (e) {
    log.error(e);
    res.status(400).send({"indexed": false});
  }
};