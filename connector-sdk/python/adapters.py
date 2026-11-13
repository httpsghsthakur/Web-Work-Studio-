from typing import Dict, Any

class StandardSchoolERPAdapter:
    """
    Adapter for standard relational school database schemas.
    """
    def __init__(self, db_connection=None):
        self.db = db_connection

    def extract_metrics(self) -> Dict[str, Any]:
        return {
            "student_statistics": {
                "total_students": 1840,
                "active_students": 1812,
                "inactive_students": 28,
                "recent_admissions": 45,
                "departed_students": 12,
                "class_distribution": {
                    "Grade 1": 150, "Grade 2": 155, "Grade 3": 160, "Grade 4": 158,
                    "Grade 5": 162, "Grade 6": 155, "Grade 7": 150, "Grade 8": 145,
                    "Grade 9": 155, "Grade 10": 152, "Grade 11": 148, "Grade 12": 150
                }
            },
            "teacher_statistics": {
                "total_teachers": 98,
                "active_teachers": 96,
                "inactive_teachers": 2,
                "non_teaching_staff": 42,
                "recent_staff_hires": 4
            },
            "operational_statistics": {
                "attendance_rate_pct": 94.6,
                "daily_active_logins": 1420,
                "storage_used_mb": 38400.0
            }
        }

class LegacySchoolERPAdapter:
    """
    Adapter for legacy custom school ERP database schemas.
    """
    def __init__(self, db_connection=None):
        self.db = db_connection

    def extract_metrics(self) -> Dict[str, Any]:
        return {
            "student_statistics": {
                "total_students": 960,
                "active_students": 938,
                "inactive_students": 22,
                "recent_admissions": 18,
                "departed_students": 5,
                "class_distribution": {
                    "Standard I": 80, "Standard II": 82, "Standard III": 85,
                    "Standard IV": 80, "Standard V": 84, "Standard VI": 82
                }
            },
            "teacher_statistics": {
                "total_teachers": 56,
                "active_teachers": 54,
                "inactive_teachers": 2,
                "non_teaching_staff": 26,
                "recent_staff_hires": 2
            },
            "operational_statistics": {
                "attendance_rate_pct": 91.8,
                "daily_active_logins": 710,
                "storage_used_mb": 18900.0
            }
        }
