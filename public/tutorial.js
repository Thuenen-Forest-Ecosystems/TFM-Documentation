// Get the popup elements from the DOM
let container = document.getElementById("popup");
let content = document.getElementById("popup-content");
let closer = document.getElementById("popup-closer");

// Variable to store the grid cell for later data retrieval
let GridCell = "";

// Helper function to call the API endpoint and get details for a specific cluster
async function getDetails(itemId) {
  // Build API request for cluster (including dependend data)
  const url2 = `https://ci.thuenen.de/rest/v1/cluster?select=*,plot!fk_plot_cluster(*,tree(*),deadwood(*),regeneration(*),structure_lt4m(*),edges(*))&inspire_grid_cell=eq.${itemId}`;
  // headers for Auth and database scheme to use
  const headers2 = {
    apikey:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAiVEZNIiwKICAiaWF0IjogMTczOTkxOTYwMCwKICAiZXhwIjogMTg5NzY4NjAwMAp9.L28Sk6wzRLoUh1wLz_TjeY_rtUp3UX3-6UttadUEoC0",
    "Accept-Profile": "inventory_archive",
  };
  // now we try to get the data
  fetch(url2, { headers: headers2 })
    .then(function (response) {
      return response.json();
    })
    .then((data) => {
      // prepare and provide some statistics
      const data2 = [JSON.stringify(data[0], null, 1)];

      let treeCount = 0;
      let treeCountWithH = 0;
      let treeCountWithD = 0;
      let dbhSum = 0;
      let treeHeightSum = 0;
      let minDbh = Infinity;
      let maxDbh = -Infinity;
      let minTreeHeight = Infinity;
      let maxTreeHeight = -Infinity;

      // Iterate through the data to calculate statistics
      data.forEach((source) => {
        if (source.plot) {
          source.plot.forEach((plot) => {
            if (plot.tree) {
              plot.tree.forEach((tree) => {
                treeCount++;

                // Calculate dbh (diameter at breast height) statistics
                if (tree.dbh !== null && tree.dbh !== undefined) {
                  const dbh = parseFloat(tree.dbh);
                  dbhSum += dbh;
                  treeCountWithD++;
                  if (dbh < minDbh) minDbh = dbh;
                  if (dbh > maxDbh) maxDbh = dbh;
                }

                // Calculate tree height statistics
                if (
                  tree.tree_height !== null &&
                  tree.tree_height !== undefined
                ) {
                  const treeHeight = parseFloat(tree.tree_height);
                  treeHeightSum += treeHeight;
                  treeCountWithH++;
                  if (treeHeight < minTreeHeight) minTreeHeight = treeHeight;
                  if (treeHeight > maxTreeHeight) maxTreeHeight = treeHeight;
                }
              });
            }
          });
        }
      });

      // Calculate average dbh and tree height
      const dbhAverage = Math.round(dbhSum / treeCountWithD, 1);
      const treeHeightAverage = Math.round(treeHeightSum / treeCountWithH, 1);

      // Log and display the calculated statistics
      console.log(`Anzahl der tree-Elemente: ${treeCount}`);
      console.log(`Anzahl der tree-Elemente mit DBH: ${treeCountWithD}`);
      console.log(`Anzahl der tree-Elemente mit Hoehe: ${treeCountWithH}`);
      console.log(`Minimaler dbh-Wert: ${minDbh}`);
      console.log(`Maximaler dbh-Wert: ${maxDbh}`);
      console.log(`Durchschnittlicher dbh-Wert: ${dbhAverage}`);
      console.log(`Minimaler tree_height-Wert: ${minTreeHeight}`);
      console.log(`Maximaler tree_height-Wert: ${maxTreeHeight}`);
      console.log(`Durchschnittlicher tree_height-Wert: ${treeHeightAverage}`);
      if (treeCount > 0) {
        content.innerHTML += `Der Trakt in dieser Zelle enthält <code>${treeCount}</code> WZP4-Bäume.</br>Gemessene BHDs: <code>${
          minDbh / 10
        }</code> cm bis <code>${maxDbh / 10}</code> cm, im Mittel <code>${
          dbhAverage / 10
        }</code> cm.</br>Gemessene Baumhöhen: <code>${
          minTreeHeight / 10
        }</code> m bis <code>${maxTreeHeight / 10}</code> m, im Mittel <code>${
          treeHeightAverage / 10
        }</code> m.`;
      } else {
        content.innerHTML += `Diese Zelle enthält keine Daten zu WZP-Bäumen.`;
      }

      // provide the raw data in pretty format
      if (data[0]) {
        content.innerHTML += `</br></br><b>Rohdaten (zum Auf- und Zuklappen):</b></br><pre><pretty-json expand="1"><code>${JSON.stringify(
          data[0],
          null,
          1
        )}</code></pretty-json></pre>`;
      } else {
        content.innerHTML += `</br></br>Kein BWI-Trakt in dieser Zelle verfügbar.`;
      }
    });
}

// Helper function to call wms for getting grid cell
async function getGridcell(coordinate) {
  const viewResolution = map.getView().getResolution();
  abc = map.getLayers().item(1).getSource().getFeatureInfoUrl;
  const url = map
    .getLayers()
    .item(1)
    .getSource()
    .getFeatureInfoUrl(coordinate, viewResolution, "EPSG:3857", {
      INFO_FORMAT: "application/json",
    });
  if (url) {
    fetch(url)
      .then(function (response) {
        return response.json();
      })
      .then((data) => {
        GridCell = data.features[0].properties.ID_1km;
        content.innerHTML = `<pre><b>LAEA-Gitterzelle (1km): <code>${JSON.stringify(
          GridCell,
          null,
          1
        )}</code></b></pre>`;
        (async () => {
          await getDetails(GridCell);
        })();
        return GridCell;
      });
  }
}

// Create an overlay to anchor the popup to the map.
let overlay = new ol.Overlay({
  element: container,
  autoPan: true,
  autoPanAnimation: {
    duration: 250,
  },
});

// Add a click handler to hide the popup.
closer.onclick = function () {
  overlay.setPosition(undefined);
  closer.blur();
  return false;
};

// the layers to show
let layers = [
  new ol.layer.Tile({
    source: new ol.source.OSM(),
  }),
  new ol.layer.Tile({
    opacity: 0.4,
    source: new ol.source.TileWMS({
      url: "https://gdi.thuenen.de/geoserver/wo-bwi/test/wms",
      params: { LAYERS: "DE_Gitter_ETRS89_LAEA_1km", TILED: true },
      transition: 0,
    }),
  }),
  new ol.layer.Tile({
    opacity: 0.4,
    source: new ol.source.TileWMS({
      url: "https://gdi.thuenen.de/geoserver/wo-bwi/bwi-tnr-ano/wms",
      params: { LAYERS: "Anonym_Trakt23VI_PolyVar_Inventur", TILED: true },
      transition: 0,
    }),
  }),
];

// the map
let map = new ol.Map({
  target: "map",
  layers: layers,
  overlays: [overlay],
  view: new ol.View({
    center: ol.proj.fromLonLat([11.5, 51]),
    zoom: 6,
  }),
});

// this starts if we click on the map
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
});

// toggle opacity of layers
function switchbluegrid() {
  if (layers[1].getOpacity() == 0.4) {
    layers[1].setOpacity(0);
  } else if (layers[1].getOpacity() == 0) {
    layers[1].setOpacity(0.4);
  }
}
function switchhelpergrid() {
  //alert(layers[2].getOpacity()  );
  if (layers[2].getOpacity() == 0.4) {
    layers[2].setOpacity(0);
  } else if (layers[2].getOpacity() == 0) {
    layers[2].setOpacity(0.4);
  }
}

//go back to docs page
function back2main() {
  if (confirm("Do you really want to go back to docs?")) {
    location.href = "./map_example.html";
  }
}
