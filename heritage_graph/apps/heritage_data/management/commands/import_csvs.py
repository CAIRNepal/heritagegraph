import csv
import os

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand

from apps.heritage_data.models import Submission


class Command(BaseCommand):
    help = "Import CSV files into Submission model"

    def add_arguments(self, parser):
        parser.add_argument(
            "csv_directory", type=str, help="Path to directory containing CSV files"
        )
        parser.add_argument(
            "--user-id", type=int, required=True, help="ID of contributor user"
        )

    def handle(self, *args, **options):
        csv_directory = options["csv_directory"]
        user_id = options["user_id"]

        try:
            contributor = User.objects.get(id=user_id)
        except User.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(f"User with ID {user_id} does not exist")
            )
            return

        if not os.path.exists(csv_directory):
            self.stdout.write(
                self.style.ERROR(f"Directory {csv_directory} does not exist")
            )
            return

        csv_files = [f for f in os.listdir(csv_directory) if f.endswith(".csv")]

        if not csv_files:
            self.stdout.write(self.style.WARNING("No CSV files found in directory"))
            return

        for csv_file in csv_files:
            file_path = os.path.join(csv_directory, csv_file)
            self.stdout.write(f"Processing {file_path}...")
            self.process_csv(file_path, contributor)

    def process_csv(self, file_path, contributor):
        # Group data by Resource ID
        resource_data = {}

        with open(file_path, "r", encoding="utf-8") as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                resource_id = row["Resource ID"]
                if resource_id not in resource_data:
                    resource_data[resource_id] = []
                resource_data[resource_id].append(row)

        # Process each resource
        for resource_id, rows in resource_data.items():
            self.create_submission(resource_id, rows, contributor)

    def create_submission(self, resource_id, rows, contributor):
        # Find Monument name to use as title
        monument_name = next(
            (
                row["Value"].strip()
                for row in rows
                if row["Label"].strip() == "Monument name"
            ),
            None,
        )

        # Initialize fields
        submission_data = {
            "submission_id": resource_id,
            "title": monument_name or rows[0]["Report Title"],
            "description": "",
            "contributor": contributor,
            "contribution_type": "heritage_documentation",
            "contribution_data": {},
        }

        # Process all rows for this resource
        # description_parts = []
        object_data = []
        current_object = {}

        for row in rows:
            label = row["Label"].strip()
            value = row["Value"].strip()

            field_name = self.map_field_name(label)

            if field_name:
                # Special handling for description fields
                if field_name in [
                    "description",
                    "Description_in_Nepali",
                    "Short_description",
                ]:
                    if value:
                        submission_data[field_name] = value
                # Handle object-specific fields
                elif label in [
                    "Name",
                    "Object ID number",
                    "Object type",
                    "Object material",
                    "Object location",
                    "Date (BCE/CE)",
                    "Commentary",
                ]:
                    if label == "Name" and current_object:
                        object_data.append(current_object)
                        current_object = {}
                    current_object[label] = value
                # Handle direct field mappings
                elif hasattr(Submission, field_name):
                    submission_data[field_name] = value
                # Store unmapped fields
                else:
                    submission_data["contribution_data"][label] = value

        # Add last object if exists
        if current_object:
            object_data.append(current_object)

        # Add objects to contribution_data
        if object_data:
            submission_data["contribution_data"]["objects"] = object_data

        try:
            valid_fields = {f.name for f in Submission._meta.get_fields()}
            filtered_data = {
                k: v
                for k, v in submission_data.items()
                if k in valid_fields or k == "contribution_data"
            }

            submission, created = Submission.objects.update_or_create(
                submission_id=resource_id, defaults=filtered_data
            )

            if created:
                self.stdout.write(
                    self.style.SUCCESS(f"Created submission {resource_id}")
                )
            else:
                self.stdout.write(
                    self.style.SUCCESS(f"Updated submission {resource_id}")
                )

        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"Error processing {resource_id}: {str(e)}")
            )

    def map_field_name(self, label):
        """Map CSV labels to model field names"""
        field_mapping = {
            "Monument name": "Monument_name",
            "Anglicized name": "Anglicized_name",
            "Name in Devanagari": "Name_in_Devanagari",
            "Monument type": "Monument_type",
            "Religion": "Religion",
            "Province number": "Province_number",
            "District": "District",
            "Municipality / village council": "Municipality_village_council",
            "Heritage focus area": "Heritage_focus_area",
            "City quarter (tola)": "City_quarter_tola",
            "Short description": "Short_description",
            "Description": "description",
            "Description in Nepali": "Description_in_Nepali",
            "Monument length": "Monument_length",
            "Monument depth": "Monument_depth",
            "Monument height  (approximate)": "Monument_height_approximate",
            "Monument diameter": "Monument_diameter",
            "Monument shape": "Monument_shape",
            "Number of storeys": "Number_of_storeys",
            "Thickness of main wall": "Thickness_of_main_wall",
            "Type of bricks": "Type_of_bricks",
            "Number of wood-carved windows": "Number_of_wood_carved_windows",
            "Number of doors": "Number_of_doors",
            "Number of bays (front)": "Number_of_bays_front",
            "Number of bays (sides)": "Number_of_bays_sides",
            "Number of plinth": "Number_of_plinth",
            "Base plinth's width": "Base_plinth_width",
            "Base plinth's depth": "Base_plinth_depth",
            "Base plinth's height": "Base_plinth_height",
            "Top plinth's width": "Top_plinth_width",
            "Top plinth's depth": "Top_plinth_depth",
            "Top plinth's height": "Top_plinth_height",
            "Monument assessment": "Monument_assessment",
            "Identified threats": "Identified_threats",
            "Activity": "Activity",
            "Editorial team": "Editorial_team",
            "Main deity in the sanctum": "Main_deity_in_the_sanctum",
            "Date (BCE/CE)": "Date_BCE_CE",
            "Date (VS/NS)": "Date_VS_NS",
            "Forms of columns": "Forms_of_columns",
            "Gate": "Gate",
            "Height": "Height",
            "Width": "Width",
            "Depth": "Depth",
            "Circumference": "Circumference",
            "Profile at base": "Profile_at_base",
            "Edge at platform": "Edge_at_platform",
            "Platform floor": "Platform_floor",
            "Column height": "Column_height",
            "Column width": "Column_width",
            "Column depth": "Column_depth",
            "Lintel height": "Lintel_height",
            "Lintel width": "Lintel_width",
            "Lintel depth": "Lintel_depth",
            "Capital height": "Capital_height",
            "Capital width": "Capital_width",
            "Capital depth": "Capital_depth",
            "Cakula height": "Cakula_height",
            "Cakula width": "Cakula_width",
            "Cakula depth": "Cakula_depth",
            "Alternative name(s)": "Alternative_name_s",
            "Inscription identification number": "Inscription_identification_number",
            "Image declaration": "Image_declaration",
            "Peculiarities": "Peculiarities",
            "Period": "Period",
            "Reference source": "Reference_source",
            "Roofing": "Roofing",
            "Sources": "Sources",
            "Type of roof": "Type_of_roof",
            "Year (SS/NS/VS)": "Year_SS_NS_VS",
            "Nepali month": "Nepali_month",
            "Tithi": "Tithi",
            "Paksa": "Paksa",
            "End date": "End_date",
            "Event name": "Event_name",
            "Details": "Details",
            "Maps and drawing type": "Maps_and_drawing_type",
            "Description for past interventions": "Description_for_past_interventions",
            "Object ID number": "Object_ID_number",
            "Object location": "Object_location",
            "Object material": "Object_material",
            "Object type": "Object_type",
        }

        return field_mapping.get(label)


# Usage:
# python manage.py import_csvs /path/to/csv/directory --user-id 1
