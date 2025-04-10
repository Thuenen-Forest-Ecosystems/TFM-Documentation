import pandas as pd
import requests

class BearerAuth(requests.auth.AuthBase):
    def __init__(self, token, profile):
        self.token = token
        self.profile = profile
    def __call__(self, r):
        r.headers["apikey"] = self.token
        r.headers["Accept-Profile"] = self.profile
        return r
    
class RequestHandler():
    def __init__(self, baseUrl, token=None, profile=None, endPoint=None):
        self.baseUrl = baseUrl
        self.token = token
        self.profile = profile
        self.set_endpoint(endPoint)
    
    def set_endpoint(self, endPoint):
        self.endPoint = endPoint

    def get_response(self):
        if(not self.set_endpoint):
            return
        self.response = requests.get(self.baseUrl+self.endPoint, auth=BearerAuth(self.token, self.profile))
    
    def check_status(self):
        if(self.response.status_code in [200]):
            self._isAuthorized = True
        else:
            self._isAuthorized = False

    def isAuthorized(self):
        self.check_status()
        return self._isAuthorized

    def return_response_dataFrame(self) -> pd.DataFrame:
        """
        """
        if(self.isAuthorized()):
            return pd.DataFrame.from_records(self.response.json())
        else:
            print("Failed to retrieve data")

baseUrl = "https://ci.thuenen.de/rest/v1/"
authToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAiVEZNIiwKICAiaWF0IjogMTczOTkxOTYwMCwKICAiZXhwIjogMTg5NzY4NjAwMAp9.L28Sk6wzRLoUh1wLz_TjeY_rtUp3UX3-6UttadUEoC0'
acctProfile = 'inventory_archive'
endPoint = "cluster?states_affected=cd.{5}&select=cluster_name,plot!fk_plot_cluster(plot_name,tree(dbh,tree_species))&plot.tree.dbh=not.is.null"

requestHand = RequestHandler(baseUrl=baseUrl,
                             token=authToken,
                             profile=acctProfile,
                             endPoint=endPoint
                             )

requestHand.get_response()

dfData = requestHand.return_response_dataFrame().set_index('cluster_name')
dfPlots = pd.concat([pd.DataFrame.from_records(df).assign(cluster_name=key) for key, df in dfData.loc[:,'plot'].items()], ignore_index=True)
# Set cluster_name as index, to keep information in DataFrame for trees
dfPlots.set_index('cluster_name',inplace=True)
# Get all trees out of dfPlots
dfTrees = pd.concat([pd.DataFrame.from_records(df).assign(cluster_name=key) for key, df in dfPlots.loc[:,'tree'].items()], ignore_index=True)

# print summary
print(dfTrees.groupby('tree_species')['dbh'].describe())

# Part with named tree species
# prepare to get lookup table
endPoint = 'lookup_tree_species'
requestHand = RequestHandler(baseUrl=baseUrl,
                             token=authToken,
                             endPoint=endPoint,
                             profile='lookup'
                             )

# get lookup table
requestHand.get_response()
dfLookupTreeSpec = requestHand.return_response_dataFrame()

# Join with lookup table for tree species and print summary
print(dfTrees.join(dfLookupTreeSpec.set_index('code'), on=['tree_species'], how='left')[['dbh','tree_species','name_de']].groupby('name_de')['dbh'].describe())