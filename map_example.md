# Simple map application as showcase for data visualization in a map 

We demonstrate conceptually how to create a map with [openlayers](https://openlayers.org/) to visualize data from the [API](./general-api.md).

As the geogrphical positions of the NFI clusters have to be kept confidential, the public NFI data in the API is referenced to the 1x1 km LAEA grid cells.
Therefore we use this cells to show the data of NFI clusters at their approximate position on the map.

In the example provided here we simply overlay an [OSM basemap](https://www.openstreetmap.org/) with two WMS layers:
- the 1 km LAEA grid for Germany, taken from [here](https://gdz.bkg.bund.de/index.php/default/geographische-gitter-fur-deutschland-in-lambert-projektion-geogitter-inspire.html),
- an adapted version of it using NFI data from 2012.

For easier orientation and better understanding of the data, the layers can be shown or hidden.

With some JS code we add then additional funcionality to the map.

When clicking on the map:
- we retrieve the name of the LAEA grid cell from the first map layer,
- we use this name make an API call in order to retrieve structured data of the potential cluster in the grid cell (if any), including its dependent objects (plots, trees, etc.),
- we visualize the cluster details returned by the API as a structured data tree in a popup, along with calculating and presenting some statistics for the trees in that cluster (if any).

This information is displayed only for grid cells that contain a NFI cluster somewhere within the cell.

If a cell is clicked that does not contain a NFI cluster, the popup displays a corresponding message.

<v-card style="border-radius: 10px">
    <iframe
        marginwidth="0"
        marginheight="0"
        src="/TFM-Documentation/map.html"
        width="100%"
        height="750"
        style="border: 1px solid black">
    </iframe>
</v-card>

[Source Code of HTML](https://github.com/Thuenen-Forest-Ecosystems/TFM-Documentation/blob/main/public/map.html)

[Source Code of main JS](https://github.com/Thuenen-Forest-Ecosystems/TFM-Documentation/blob/main/public/tutorial.js)

<!--
[Source Code of supplementary JS](https://github.com/Thuenen-Forest-Ecosystems/TFM-Documentation/blob/main/public/pretty-json.js) taken from [Github](https://github.com/mohsen1/pretty-json)

Have fun with the [example application](https://thuenen-forest-ecosystems.github.io/TFM-Documentation/map.html)!
-->

Feedback is welcome.