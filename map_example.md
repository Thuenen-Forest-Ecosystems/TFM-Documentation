# Simple map application as showcase for data visualization in a map 

Here we show conceptually how to make a map with openlayers
On the map we overlay an OSM basemap with 2 layers:
- the 1km LAEA grid for Germany taken from https://gdz.bkg.bund.de/index.php/default/geographische-gitter-fur-deutschland-in-lambert-projektion-geogitter-inspire.html
- an adapted Version of this with NFI data from 2012

The layers can be toggled on and off to make orientation easier and to better understand the data.

By clicking on the map we visualize details of the cluster located in the respective grid cell and their dependend objects (plots, trees, ...) as structured data trees in a popup as well as some statistics for the trees at this cluster (if there are trees).
This information is shown for the grid cells where a NFI cluster is located somwhere within the cell without revealing the exact position of the cluster itself (which is confidential).

If a cell not containing a NFI cluster is clicked, the popup shows a message acordingly.

[Source Code of HTML](https://github.com/Thuenen-Forest-Ecosystems/TFM-Documentation/blob/main/public/map.html)

[Source Code of main JS](https://github.com/Thuenen-Forest-Ecosystems/TFM-Documentation/blob/main/public/tutorial.js)

[Source Code of supplementary JS](https://github.com/Thuenen-Forest-Ecosystems/TFM-Documentation/blob/main/public/pretty-json.js) taken from https://github.com/mohsen1/pretty-json


Have fun with the [example application](https://thuenen-forest-ecosystems.github.io/TFM-Documentation/map.html)!