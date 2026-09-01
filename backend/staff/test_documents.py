import tempfile
from datetime import date
from pathlib import Path

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APITestCase

from staff.document_files import validate_staff_document
from staff.models import StaffDetails, StaffDocument
from masters.models import MenuMaster
from staff.models import StaffMenuPermission


def make_upload(name="contract.pdf", size=32, content_type="application/pdf"):
    return SimpleUploadedFile(name, b"x" * size, content_type=content_type)


class StaffDocumentModelTests(TestCase):
    def setUp(self):
        self.media_dir = tempfile.TemporaryDirectory()
        self.media_override = override_settings(MEDIA_ROOT=self.media_dir.name)
        self.media_override.enable()
        self.user = User.objects.create_user(username="document-owner")
        self.staff = StaffDetails.objects.create(
            User_Id=self.user,
            Full_Name="Document Owner",
            Designation="Consultant",
            Email_Address="documents@example.com",
            Phone_Number="9999999999",
            Hire_Date=date(2026, 1, 1),
            Role="Staff",
            Is_Active=True,
        )

    def tearDown(self):
        self.media_override.disable()
        self.media_dir.cleanup()

    def create_document(self, name="contract.pdf"):
        file = make_upload(name)
        return StaffDocument.objects.create(
            Staff_Id=self.staff,
            Document_File=file,
            Original_Name=name,
            Mime_Type=file.content_type,
            File_Size=file.size,
            Uploaded_By=self.user,
        )

    def test_document_belongs_to_staff_and_records_metadata(self):
        document = self.create_document()

        self.assertEqual(document.Staff_Id_id, self.staff.pk)
        self.assertTrue(
            document.Document_File.name.startswith(
                f"staff/documents/{self.staff.pk}/"
            )
        )
        self.assertEqual(document.Original_Name, "contract.pdf")

    def test_rejects_file_larger_than_ten_megabytes(self):
        with self.assertRaisesMessage(ValidationError, "10 MB"):
            validate_staff_document(
                make_upload(size=10 * 1024 * 1024 + 1)
            )

    def test_rejects_executable_extension(self):
        with self.assertRaisesMessage(ValidationError, "not supported"):
            validate_staff_document(
                make_upload("payload.exe", content_type="application/octet-stream")
            )

    def test_deleting_document_removes_physical_file(self):
        document = self.create_document()
        stored_path = Path(document.Document_File.path)
        self.assertTrue(stored_path.exists())

        document.delete()

        self.assertFalse(stored_path.exists())

    def test_deleting_staff_cascades_documents_and_physical_files(self):
        document = self.create_document()
        document_id = document.pk
        stored_path = Path(document.Document_File.path)

        self.staff.delete()

        self.assertFalse(StaffDocument.objects.filter(pk=document_id).exists())
        self.assertFalse(stored_path.exists())


class StaffDocumentSerializerTests(APITestCase):
    def setUp(self):
        self.media_dir = tempfile.TemporaryDirectory()
        self.media_override = override_settings(MEDIA_ROOT=self.media_dir.name)
        self.media_override.enable()
        self.admin_user = User.objects.create_user(username="document-admin")
        self.admin_staff = StaffDetails.objects.create(
            User_Id=self.admin_user,
            Full_Name="Document Admin",
            Designation="Administrator",
            Email_Address="document-admin@example.com",
            Phone_Number="9999999999",
            Hire_Date=date(2026, 1, 1),
            Role="Admin",
            Is_Active=True,
        )
        self.client.force_authenticate(self.admin_user)

    def tearDown(self):
        self.media_override.disable()
        self.media_dir.cleanup()

    def valid_staff_payload(self, username="new-document-staff"):
        return {
            "Full_Name": "New Document Staff",
            "Designation": "Consultant",
            "Email_Address": f"{username}@example.com",
            "Phone_Number": "8888888888",
            "Hire_Date": "2026-09-01",
            "Role": "Staff",
            "Is_Active": "true",
            "Username": username,
            "Password": "secure-password",
            "Confirm_Password": "secure-password",
            "Menu_Permissions": "[]",
        }

    def valid_update_payload(self):
        return {
            "Full_Name": self.admin_staff.Full_Name,
            "Designation": self.admin_staff.Designation,
            "Email_Address": self.admin_staff.Email_Address,
            "Phone_Number": self.admin_staff.Phone_Number,
            "Hire_Date": self.admin_staff.Hire_Date.isoformat(),
            "Role": self.admin_staff.Role,
            "Is_Active": "true",
            "Menu_Permissions": "[]",
        }

    def test_create_staff_saves_multiple_documents(self):
        payload = self.valid_staff_payload()
        payload["Staff_Documents"] = [
            make_upload("contract.pdf"),
            make_upload("identity.png", content_type="image/png"),
        ]

        response = self.client.post("/api/staff/", payload, format="multipart")

        self.assertEqual(response.status_code, 201, response.data)
        staff = StaffDetails.objects.get(pk=response.data["Id"])
        self.assertEqual(staff.Documents.count(), 2)
        self.assertEqual(
            {row["Original_Name"] for row in response.data["Documents"]},
            {"contract.pdf", "identity.png"},
        )

    def test_create_staff_accepts_matching_password_shorter_than_six_characters(self):
        payload = self.valid_staff_payload("short-password-staff")
        payload["Password"] = "123"
        payload["Confirm_Password"] = "123"

        response = self.client.post("/api/staff/", payload, format="multipart")

        self.assertEqual(response.status_code, 201, response.data)
        created_user = User.objects.get(username="short-password-staff")
        self.assertTrue(created_user.check_password("123"))

    def test_update_appends_document_without_removing_existing_document(self):
        existing_file = make_upload("existing.pdf")
        StaffDocument.objects.create(
            Staff_Id=self.admin_staff,
            Document_File=existing_file,
            Original_Name=existing_file.name,
            Mime_Type=existing_file.content_type,
            File_Size=existing_file.size,
            Uploaded_By=self.admin_user,
        )
        payload = self.valid_update_payload()
        payload["Staff_Documents"] = [make_upload("new.pdf")]

        response = self.client.put(
            f"/api/staff/{self.admin_staff.pk}/", payload, format="multipart"
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.admin_staff.Documents.count(), 2)

    def test_invalid_document_rejects_staff_before_creation(self):
        payload = self.valid_staff_payload("unsafe-document-staff")
        payload["Staff_Documents"] = [
            make_upload("payload.exe", content_type="application/octet-stream")
        ]

        response = self.client.post("/api/staff/", payload, format="multipart")

        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(username="unsafe-document-staff").exists())
        self.assertIn("payload.exe", str(response.data))


class StaffDocumentEndpointTests(APITestCase):
    def setUp(self):
        self.media_dir = tempfile.TemporaryDirectory()
        self.media_override = override_settings(MEDIA_ROOT=self.media_dir.name)
        self.media_override.enable()
        self.admin_user, self.admin_staff = self.make_staff(
            "endpoint-admin", "Endpoint Admin", "Admin"
        )
        self.other_user, self.other_staff = self.make_staff(
            "endpoint-other", "Endpoint Other", "Staff"
        )
        file = make_upload("contract.pdf")
        self.document = StaffDocument.objects.create(
            Staff_Id=self.admin_staff,
            Document_File=file,
            Original_Name=file.name,
            Mime_Type=file.content_type,
            File_Size=file.size,
            Uploaded_By=self.admin_user,
        )
        self.client.force_authenticate(self.admin_user)

    def tearDown(self):
        self.media_override.disable()
        self.media_dir.cleanup()

    def make_staff(self, username, name, role):
        user = User.objects.create_user(username=username)
        staff = StaffDetails.objects.create(
            User_Id=user,
            Full_Name=name,
            Designation="Consultant",
            Email_Address=f"{username}@example.com",
            Phone_Number="9999999999",
            Hire_Date=date(2026, 1, 1),
            Role=role,
            Is_Active=True,
        )
        return user, staff

    def grant_staff_access(self, staff, *, can_edit=False):
        menu, _ = MenuMaster.objects.get_or_create(Menu_Name="Staff List")
        StaffMenuPermission.objects.create(
            Staff=staff,
            Menu=menu,
            Can_View=True,
            Can_Edit=can_edit,
        )

    def test_admin_downloads_document(self):
        response = self.client.get(
            f"/api/staff/{self.admin_staff.pk}/documents/{self.document.pk}/download/"
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("contract.pdf", response["Content-Disposition"])
        for closer in response._resource_closers:
            closer()
        response._resource_closers.clear()

    def test_admin_deletes_document_and_physical_file(self):
        stored_path = Path(self.document.Document_File.path)

        response = self.client.delete(
            f"/api/staff/{self.admin_staff.pk}/documents/{self.document.pk}/"
        )

        self.assertEqual(response.status_code, 204)
        self.assertFalse(stored_path.exists())
        self.assertFalse(StaffDocument.objects.filter(pk=self.document.pk).exists())

    def test_nested_route_cannot_access_document_from_another_staff(self):
        response = self.client.get(
            f"/api/staff/{self.other_staff.pk}/documents/{self.document.pk}/download/"
        )

        self.assertEqual(response.status_code, 404)

    def test_view_only_staff_cannot_delete_document(self):
        self.grant_staff_access(self.other_staff, can_edit=False)
        self.client.force_authenticate(self.other_user)

        response = self.client.delete(
            f"/api/staff/{self.admin_staff.pk}/documents/{self.document.pk}/"
        )

        self.assertEqual(response.status_code, 403)

    def test_staff_without_view_access_cannot_download_document(self):
        self.client.force_authenticate(self.other_user)

        response = self.client.get(
            f"/api/staff/{self.admin_staff.pk}/documents/{self.document.pk}/download/"
        )

        self.assertEqual(response.status_code, 403)
