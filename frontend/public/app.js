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

var app = new Vue({
  el: '#app',
  data() {
    return { 
      pictures: [],
      query: undefined,
      colors: [],
      labels: [],
      objects: []
    }
  },
  computed: {
    url: function() {
      const searchParams = new URLSearchParams();
      if (!!this.query) searchParams.append('q', this.query);
      this.colors.forEach(c => { searchParams.append('c', c.bgColor); });
      this.labels.forEach(l => { searchParams.append('l', l); });
      this.objects.forEach(o => { searchParams.append('o', o); });
      console.log(searchParams.toString());
      return searchParams.toString();
    }
  },
  mounted() {
    const urlSearchParam = new URLSearchParams(window.location.search);
    this.populateDataFromQuery(urlSearchParam);

    axios
      .get('/api/pictures?' + this.url)
      .then(response => { this.pictures = response.data })
      .catch(e => console.log("Error from Vue calling API:", e))
  },
  methods: {
    "onSearchEnter": function() {
      window.location = '?' + this.url;
    },
    "populateDataFromQuery": function(urlSearchParams) {
      this.query = urlSearchParams.get('q');
      this.labels = urlSearchParams.getAll('l');
      this.objects = urlSearchParams.getAll('o');
      urlSearchParams.getAll('c').forEach(c => {
        const r = parseInt(c.slice(1, 3), 16);
        const g = parseInt(c.slice(3, 5), 16);
        const b = parseInt(c.slice(5, 7), 16);
        this.colors.push(this.newColor(r, g, b));
      });
    },
    "newColor": function(r, g, b) {
      return {
        red: r, green: g, blue: b, 
        bgColor: '#' +  r.toString(16).padStart(2, '0') + 
                        g.toString(16).padStart(2, '0') + 
                        b.toString(16).padStart(2, '0'),
        textColor: (r + g + b) > 384 ? 'has-text-black' : 'has-text-white'
      }
    },
    "addFacet": function(facetType, facetValue) {
      if (facetType === 'color') {
        const newColor = this.newColor(facetValue.red, facetValue.green, facetValue.blue);
        if (this.colors.find(c => c.bgColor === newColor.bgColor) === undefined) {
          this.colors.push(newColor);
        }
      } else if (facetType === 'label') {
        if (this.labels.indexOf(facetValue) < 0) {
          this.labels.push(facetValue);
        }
      } else if (facetType === 'object') {
        if (this.objects.indexOf(facetValue) < 0) {
          this.objects.push(facetValue);
        }
      } else { console.log(`No facet of type ${facetType}`); }
      this.onSearchEnter();
    },
    "removeFacet": function(facetType, facetValue) {
      if (facetType === 'color') {
        this.$delete(this.colors, this.colors.indexOf(facetValue));
      } else if (facetType === 'label') {
        this.$delete(this.labels, this.labels.indexOf(facetValue));
      } else if (facetType === 'object') {
        this.$delete(this.objects, this.objects.indexOf(facetValue));
      } else { console.log(`No facet of type ${facetType}`); }
      this.onSearchEnter();
    }
  }
})
