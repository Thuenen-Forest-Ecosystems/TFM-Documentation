/* Name of the file: tutorial.js */

/**
 * Elements that make up the popup.
 */
let container = document.getElementById("popup");
let content = document.getElementById("popup-content");
let closer = document.getElementById("popup-closer");
let GridCell = "";

// Helper function to call the API endpoint and get details for a specific cluster
async function getDetails(itemId) {
  // Build API request for element of cluster list (including dependend data)
  const url2 = `https://ci.thuenen.de/rest/v1/cluster?select=*,plot!fk_plot_cluster(*,tree(*),deadwood(*),regeneration(*),structure_lt4m(*),edges(*))&inspire_grid_cell=eq.${itemId}`;
  // headers for Auth and database scheme to use
  const headers2 = {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAiVEZNIiwKICAiaWF0IjogMTczOTkxOTYwMCwKICAiZXhwIjogMTg5NzY4NjAwMAp9.L28Sk6wzRLoUh1wLz_TjeY_rtUp3UX3-6UttadUEoC0',
    'Accept-Profile': 'inventory_archive'
    };
  fetch(url2, {headers:headers2})
    .then(function (response) {
      return response.json();
    })
    .then(data => {
      content.innerHTML += `<pre><pretty-json expand="1"><code>${JSON.stringify(data[0], null, 1)}</code></pretty-json></pre>`;
  });

}

// Helper function to call wms for getting grid cell
async function getGridcell(coordinate) {
  const viewResolution = map.getView().getResolution();;
  abc = map.getLayers().item(1).getSource().getFeatureInfoUrl;
  const url = map.getLayers().item(1).getSource().getFeatureInfoUrl(
    coordinate,
    viewResolution,
    'EPSG:3857',
    {'INFO_FORMAT': 'application/json'},
  );
  if (url) {
    fetch(url)
      .then(function (response) {
        return response.json();
      })
      .then(data => {
        GridCell = data.features[0].properties.ID_1km;
        content.innerHTML = `<pre><b>GridCell:<code>${JSON.stringify(GridCell, null, 1)}</code></b></pre>`;
         (async () => {  
           await getDetails(GridCell);
         })();
        return GridCell;
    });
  }
}



/**
 * Create an overlay to anchor the popup to the map.
 */
let overlay = new ol.Overlay({
  element: container,
  autoPan: true,
  autoPanAnimation: {
    duration: 250
  }
});

/**
 * Add a click handler to hide the popup.
 * @return {boolean} Don't follow the href.
 */
closer.onclick = function () {
  overlay.setPosition(undefined);
  closer.blur();
  return false;
};

let layers = [
  new ol.layer.Tile({
    source: new ol.source.OSM()
  }),
  new ol.layer.Tile({
    opacity: 0.4,
    source: new ol.source.TileWMS({
      url: "https://gdi.thuenen.de/geoserver/wo-bwi/test/wms",
      params: { LAYERS: "DE_Gitter_ETRS89_LAEA_1km", TILED: true },
      transition: 0
    })
  })
  ,
    new ol.layer.Tile({
    opacity: 0.4,
    source: new ol.source.TileWMS({
      url: "https://gdi.thuenen.de/geoserver/wo-bwi/bwi-tnr-ano/wms",
      params: { LAYERS: "Anonym_Trakt23VI_PolyVar_Inventur", TILED: true },
      transition: 0
    })
  })
];

let map = new ol.Map({
  target: "map",
  layers: layers,
  overlays: [overlay],
  view: new ol.View({
    center: ol.proj.fromLonLat([11.5, 51]),
    zoom: 6
  })
});

map.on("singleclick", function (evt) {
  let coordinate = evt.coordinate;
  let xy_coordinates = ol.coordinate.toStringXY(
    ol.proj.toLonLat(evt.coordinate),
    4
  );
  let viewResolution = map.getView().getResolution();
  let wms_source = map.getLayers().item(1).getSource();
  content.innerHTML = '<p align="center" id="mydata">Fetching data...</p>';
  overlay.setPosition(evt.coordinate);
  console.log("test");
  console.log(xy_coordinates);
  console.log("starte datenabruf");
  (async () => {
    await getGridcell(coordinate);
  })();
}
);

function switchbluegrid() {
  //alert(layers[1].getOpacity()  );
  if (layers[1].getOpacity() == 0.4 ) {
    layers[1].setOpacity(0);
  } else if (layers[1].getOpacity() == 0) {
    layers[1].setOpacity(0.4);
  }
}

function switchhelpergrid() {
  //alert(layers[2].getOpacity()  );
  if (layers[2].getOpacity() == 0.4 ) {
    layers[2].setOpacity(0);
  } else if (layers[2].getOpacity() == 0) {
    layers[2].setOpacity(0.4);
  }
}