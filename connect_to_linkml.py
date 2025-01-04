from oxigraph_client import OxigraphClient

url = "http://localhost:7878"
username = "username"
password = "password"

# Create the Oxigraph client
client = OxigraphClient(url, username=username, password=password)


with open("OUTPUTFILE.ttl", "r") as f:
    data = f.read()

# Upload the LinkML data to the Oxigraph server
client.upload_data(data, "OUTPUTFILE.ttl", "text/turtle")