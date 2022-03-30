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
      query: undefined
    }
  },
  mounted() {
    this.query = new URLSearchParams(window.location.search).get('q');
    const url = `/api/pictures${!!this.query ? `?q=${this.query}` : ''}`;
    console.log("Search query URL", url);
    axios
      .get(url)
      .then(response => { this.pictures = response.data })
      .catch(e => console.log("Error from Vue calling API:", e))
  },
  methods: {
    "onSearchEnter": function() {
      window.location = `?q=${encodeURIComponent(this.query)}`
    }
  }
})
