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

process.on('uncaughtException', function (error) {
  console.log(error.stack);
});

const { Client } = require('@elastic/elasticsearch');
const client = new Client({ 
    cloud: {
        id: process.env.ES_CLOUD_ID
    },
    auth: {
        apiKey: process.env.ES_API_KEY
    }
});

exports.indexPictureMetadata = async (req, res) => {
  const resp = req.body;
  console.log("Indexing picture metadata", JSON.stringify(resp));

  const doc =  {
    name: req.query.id,
    safe: true,
    created: new Date().toISOString(),
    text: resp?.responses?.[0]?.fullTextAnnotation?.text,
    colors: resp?.responses?.[0]?.imagePropertiesAnnotation?.dominantColors?.colors?.map(col => { return {
      red: col?.color?.red || 0,
      green: col?.color?.green || 0,
      blue: col?.color?.blue || 0,
    }}), 
    labels: resp?.responses?.[0]?.labelAnnotations?.map(lbl => lbl?.description),
    objects: resp?.responses?.[0]?.localizedObjectAnnotations?.map(obj => obj?.name),
    landmark: {
      name: resp?.responses?.[0]?.landmarkAnnotations?.[0]?.description,
      location: {
        lat: resp?.responses?.[0]?.landmarkAnnotations?.[0]?.locations?.[0]?.latLng?.latitude,
        lon: resp?.responses?.[0]?.landmarkAnnotations?.[0]?.locations?.[0]?.latLng?.longitude,
      }
    }
  };
  if (!doc?.landmark?.name || Object.keys(doc?.landmark?.location).length === 0) delete doc.landmark;
    
  console.log("Transformed doc", JSON.stringify(doc));

  try {
    const outcome = await client.index({
      index: 'pixxearch',
      id: Buffer.from(req.query.id).toString("base64"),
      document: doc
    })
    console.log("Index outcome", outcome);
    
    res.status(200).send({"indexed": true});
    return;
  } catch (e) {
    log.error(e);
    res.status(400).send({"indexed": false});
    return;
  }
};