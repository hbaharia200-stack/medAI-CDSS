"""MedAI backend application factory."""
from __future__ import annotations

from flask import Flask
from sqlalchemy import inspect, text

from .config import Config, get_config
from .extensions import cors, db, jwt, migrate


def create_app(config: type[Config] | None = None) -> Flask:
    app = Flask(__name__)
    cfg = config or get_config()
    app.config.from_object(cfg)

    @app.cli.command("seed-dev-users")
    def seed_dev_users_command():
        """Create idempotent development staff accounts + test catalogue."""
        if not app.config.get("DEV_SEED_USERS_ENABLED", False) or app.config.get("TESTING"):
            raise RuntimeError("seed-dev-users is disabled outside development.")
        from .services.dev_seed_service import seed_development_data

        staff_created, tests_created = seed_development_data()
        parts = []
        if staff_created:
            parts.append(f"users: {', '.join(staff_created)}")
        if tests_created:
            parts.append(f"test catalogue: {len(tests_created)}")
        print("Development data ready: " + ("; ".join(parts) if parts else "no changes"))

                    # --- Extensions -------------------------------------------------------
    db.init_app(app)
    migrate.init_app(app, db, directory="migrations")
    jwt.init_app(app)

    # Import model metadata before development schema bootstrap.
    from .models import UserRole

    if app.config.get("ENV") == "development" and not app.config.get("TESTING"):
        with app.app_context():
            # Development bootstrap is additive only. It never drops tables,
            # deletes rows, or runs in production/testing.
            db.create_all()
            columns = {column["name"] for column in inspect(db.engine).get_columns("patient_cases")}
            for column in ("location", "follow_up_answers"):
                if column not in columns:
                    db.session.execute(text(f"ALTER TABLE patient_cases ADD COLUMN {column} JSON"))
            # Doctor availability (see services/availability_service.py). Added
            # additively so existing doctor rows default to available.
            doctor_columns = {column["name"] for column in inspect(db.engine).get_columns("doctor_profiles")}
            if "is_available" not in doctor_columns:
                db.session.execute(
                    text(
                        "ALTER TABLE doctor_profiles "
                        "ADD COLUMN is_available BOOLEAN NOT NULL DEFAULT 1"
                    )
                )
            db.session.commit()
    # CORS is restricted to configured origins so API secrets/responses never
    # leak to arbitrary origins.
    cors.init_app(app, origins=app.config["CORS_ORIGINS"], supports_credentials=True)

    # JWT identity <-> User resolution so ``current_user`` is populated on
    # protected routes (and role_required can read current_user.role).
    @jwt.user_identity_loader
    def _user_identity(identity):
        # ``identity`` here is the subject we stored (user.id).
        return identity

    @jwt.user_lookup_loader
    def _user_lookup(_jwt_header, jwt_data):
        from .models import User

        identity = jwt_data["sub"]
        return db.session.get(User, identity)


    # --- JWT error handlers: safe, generic messages (no internal leakage) -
    from .utils.responses import error as error_response

    @jwt.unauthorized_loader
    def _missing_token(err):
        return error_response(str(err), "authentication_required", 401)

    @jwt.invalid_token_loader
    def _invalid_token(err):  # noqa: ARG001
        return error_response("The token supplied is invalid or expired.", "invalid_token", 422)

    @jwt.token_in_blocklist_loader
    def _check_blocklist(jwt_header, jwt_payload):
        from .models import TokenBlocklist

        jti = jwt_payload.get("jti")
        if not jti:
            return True
        return db.session.query(TokenBlocklist).filter_by(jti=jti).first() is not None

    # --- Register API blueprints -----------------------------------------
    from .api import register_api

    register_api(app)

            # --- Domain & validation error handlers --------------------------------
    from .utils import AppError, ValidationError

    @app.errorhandler(AppError)
    def _app_error(e):
        return error_response(e.message, e.code, e.status)

    @app.errorhandler(ValidationError)
    def _validation_error(e):
        return error_response(e.message, e.code, e.status)

    # Missing/unusable AI artifact is an operational condition, not a bug:
    # surface it honestly as 503 instead of a stack-traced 500.
    from .ai import AIModelNotConfigured

    @app.errorhandler(AIModelNotConfigured)
    def _ai_not_configured(e):
        return error_response(str(e), "ai_model_not_configured", 503)


    @app.errorhandler(404)
    def _not_found(e):
        return error_response(str(getattr(e, "description", e)), "not_found", 404)

    @app.errorhandler(405)
    def _method_not_allowed(e):  # noqa: ARG001
        return error_response("Method not allowed for this resource.", "method_not_allowed", 405)

    @app.errorhandler(400)
    def _bad_request(e):
        return error_response(str(getattr(e, "description", e)), "bad_request", 400)

    @app.errorhandler(401)
    def _unauthorized(e):  # noqa: ARG001
        return error_response("Authentication required.", "unauthorized", 401)

    @app.errorhandler(403)
    def _forbidden(e):  # noqa: ARG001
        return error_response("You do not have permission to perform this action.", "forbidden", 403)

    @app.errorhandler(409)
    def _conflict(e):
        return error_response(str(getattr(e, "description", e)), "conflict", 409)

    @app.errorhandler(422)
    def _unprocessable(e):
        return error_response(str(e), "validation_error", 422)

    @app.errorhandler(503)
    def _service_unavailable(e):
        return error_response(str(e), "service_unavailable", 503)

    @app.errorhandler(Exception)
    def _internal_error(e):  # noqa: BLE001
        # Roll back any half-applied transaction so the session stays usable.
        try:
            db.session.rollback()
        except Exception:  # noqa: BLE001
            pass
        # Medical data is never written to logs: only the exception type/message.
        app.logger.exception("Unhandled server error (%s)", type(e).__name__)
        return error_response(
            "An internal server error occurred.", "internal_error", 500
        )

    return app

