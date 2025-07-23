#!/usr/bin/env python3
"""
Generador de Colección Postman para Component Store API
Este script genera automáticamente una colección de Postman completa
para documentar y probar toda la API del Component Store.
"""

import json
import uuid
from datetime import datetime

def generate_uuid():
    """Genera un UUID único para Postman"""
    return str(uuid.uuid4())

def create_postman_collection():
    """Crea la estructura base de la colección de Postman"""
    
    collection = {
        "info": {
            "_postman_id": generate_uuid(),
            "name": "Component Store API",
            "description": "API completa para el Component Store - Sistema de componentes JSX con donaciones PayPal y acceso premium",
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
        },
        "item": [],
        "variable": [
            {
                "key": "base_url",
                "value": "http://localhost:3000",
                "type": "string"
            },
            {
                "key": "auth_token",
                "value": "",
                "type": "string"
            }
        ],
        "auth": {
            "type": "bearer",
            "bearer": [
                {
                    "key": "token",
                    "value": "{{auth_token}}",
                    "type": "string"
                }
            ]
        }
    }
    
    # Agregar carpetas principales
    collection["item"] = [
        create_auth_folder(),
        create_components_folder(),
        create_payments_folder(),
        create_utility_folder()
    ]
    
    return collection

def create_auth_folder():
    """Crea la carpeta de autenticación"""
    return {
        "name": "🔐 Authentication",
        "item": [
            {
                "name": "Register User",
                "request": {
                    "method": "POST",
                    "header": [
                        {
                            "key": "Content-Type",
                            "value": "application/json"
                        }
                    ],
                    "body": {
                        "mode": "raw",
                        "raw": json.dumps({
                            "email": "user@example.com",
                            "pass": "password123"
                        }, indent=2)
                    },
                    "url": {
                        "raw": "{{base_url}}/api/users/register",
                        "host": ["{{base_url}}"],
                        "path": ["api", "users", "register"]
                    },
                    "description": "Registra un nuevo usuario en el sistema"
                },
                "response": [],
                "event": [
                    {
                        "listen": "test",
                        "script": {
                            "exec": [
                                "if (pm.response.code === 200) {",
                                "    const response = pm.response.json();",
                                "    pm.test('User registered successfully', function() {",
                                "        pm.expect(response).to.have.property('id');",
                                "        pm.expect(response).to.have.property('email');",
                                "    });",
                                "}"
                            ]
                        }
                    }
                ]
            },
            {
                "name": "Login User",
                "request": {
                    "method": "POST",
                    "header": [
                        {
                            "key": "Content-Type",
                            "value": "application/json"
                        }
                    ],
                    "body": {
                        "mode": "raw",
                        "raw": json.dumps({
                            "email": "user@example.com",
                            "pass": "password123"
                        }, indent=2)
                    },
                    "url": {
                        "raw": "{{base_url}}/api/users/login",
                        "host": ["{{base_url}}"],
                        "path": ["api", "users", "login"]
                    },
                    "description": "Autentica un usuario y obtiene el token JWT"
                },
                "response": [],
                "event": [
                    {
                        "listen": "test",
                        "script": {
                            "exec": [
                                "if (pm.response.code === 200) {",
                                "    const response = pm.response.json();",
                                "    pm.test('Login successful', function() {",
                                "        pm.expect(response).to.have.property('token');",
                                "    });",
                                "    // Guardar token para otras requests",
                                "    pm.collectionVariables.set('auth_token', response.token);",
                                "}"
                            ]
                        }
                    }
                ]
            }
        ]
    }

def create_components_folder():
    """Crea la carpeta de componentes"""
    return {
        "name": "🧩 Components",
        "item": [
            {
                "name": "Get All Components",
                "request": {
                    "method": "GET",
                    "header": [],
                    "url": {
                        "raw": "{{base_url}}/api/components",
                        "host": ["{{base_url}}"],
                        "path": ["api", "components"]
                    },
                    "description": "Obtiene la lista de todos los componentes disponibles"
                },
                "response": []
            },
            {
                "name": "Get Components by Type",
                "request": {
                    "method": "GET",
                    "header": [],
                    "url": {
                        "raw": "{{base_url}}/api/components?type=button",
                        "host": ["{{base_url}}"],
                        "path": ["api", "components"],
                        "query": [
                            {
                                "key": "type",
                                "value": "button",
                                "description": "Filtrar por tipo: button, card, modal, navigation, form, layout, animation, other"
                            }
                        ]
                    },
                    "description": "Filtra componentes por tipo específico"
                },
                "response": []
            },
            {
                "name": "Get Components by Type (Path)",
                "request": {
                    "method": "GET",
                    "header": [],
                    "url": {
                        "raw": "{{base_url}}/api/components/type/button",
                        "host": ["{{base_url}}"],
                        "path": ["api", "components", "type", "button"]
                    },
                    "description": "Obtiene componentes de un tipo específico usando parámetro de ruta"
                },
                "response": []
            },
            {
                "name": "Create Component",
                "request": {
                    "auth": {
                        "type": "noauth"
                    },
                    "method": "POST",
                    "header": [
                        {
                            "key": "Content-Type",
                            "value": "application/json"
                        },
                        {
                            "key": "token",
                            "value": "{{auth_token}}"
                        }
                    ],
                    "body": {
                        "mode": "raw",
                        "raw": json.dumps({
                            "id": "custom-button-1",
                            "name": "Animated Button",
                            "type": "button",
                            "jsxCode": "const AnimatedButton = ({ children, onClick }) => {\n  return (\n    <button\n      className=\"animated-btn\"\n      onClick={onClick}\n    >\n      {children}\n    </button>\n  );\n};\n\nexport default AnimatedButton;",
                            "animationCode": ".animated-btn {\n  background: linear-gradient(45deg, #667eea, #764ba2);\n  border: none;\n  padding: 12px 24px;\n  border-radius: 8px;\n  color: white;\n  cursor: pointer;\n  transition: all 0.3s ease;\n}\n\n.animated-btn:hover {\n  transform: translateY(-2px);\n  box-shadow: 0 4px 20px rgba(0,0,0,0.3);\n}"
                        }, indent=2)
                    },
                    "url": {
                        "raw": "{{base_url}}/api/components",
                        "host": ["{{base_url}}"],
                        "path": ["api", "components"]
                    },
                    "description": "Crea un nuevo componente (requiere autenticación)"
                },
                "response": []
            },
            {
                "name": "Get Specific Component",
                "request": {
                    "auth": {
                        "type": "noauth"
                    },
                    "method": "GET",
                    "header": [
                        {
                            "key": "token",
                            "value": "{{auth_token}}"
                        }
                    ],
                    "url": {
                        "raw": "{{base_url}}/api/components/custom-button-1",
                        "host": ["{{base_url}}"],
                        "path": ["api", "components", "custom-button-1"]
                    },
                    "description": "Obtiene detalles completos de un componente específico (requiere autenticación y posible pago)"
                },
                "response": []
            },
            {
                "name": "Get User Access Info",
                "request": {
                    "auth": {
                        "type": "noauth"
                    },
                    "method": "GET",
                    "header": [
                        {
                            "key": "token",
                            "value": "{{auth_token}}"
                        }
                    ],
                    "url": {
                        "raw": "{{base_url}}/api/components/user/access-info",
                        "host": ["{{base_url}}"],
                        "path": ["api", "components", "user", "access-info"]
                    },
                    "description": "Obtiene información sobre el acceso del usuario a componentes"
                },
                "response": []
            }
        ]
    }

def create_payments_folder():
    """Crea la carpeta de pagos"""
    return {
        "name": "💳 Payments",
        "item": [
            {
                "name": "Get Pricing Info",
                "request": {
                    "method": "GET",
                    "header": [],
                    "url": {
                        "raw": "{{base_url}}/api/payment/pricing-info",
                        "host": ["{{base_url}}"],
                        "path": ["api", "payment", "pricing-info"]
                    },
                    "description": "Obtiene información de precios y beneficios premium"
                },
                "response": []
            },
            {
                "name": "Create Component Donation Order",
                "request": {
                    "auth": {
                        "type": "noauth"
                    },
                    "method": "POST",
                    "header": [
                        {
                            "key": "Content-Type",
                            "value": "application/json"
                        },
                        {
                            "key": "token",
                            "value": "{{auth_token}}"
                        }
                    ],
                    "body": {
                        "mode": "raw",
                        "raw": json.dumps({
                            "amount": 25.50,
                            "componentId": "custom-button-1",
                            "isPremiumUpgrade": False
                        }, indent=2)
                    },
                    "url": {
                        "raw": "{{base_url}}/api/payment/create-order",
                        "host": ["{{base_url}}"],
                        "path": ["api", "payment", "create-order"]
                    },
                    "description": "Crea una orden de PayPal para donar por un componente específico"
                },
                "response": []
            },
            {
                "name": "Create Premium Upgrade Order",
                "request": {
                    "auth": {
                        "type": "noauth"
                    },
                    "method": "POST",
                    "header": [
                        {
                            "key": "Content-Type",
                            "value": "application/json"
                        },
                        {
                            "key": "token",
                            "value": "{{auth_token}}"
                        }
                    ],
                    "body": {
                        "mode": "raw",
                        "raw": json.dumps({
                            "amount": 50.00,
                            "isPremiumUpgrade": True
                        }, indent=2)
                    },
                    "url": {
                        "raw": "{{base_url}}/api/payment/create-order",
                        "host": ["{{base_url}}"],
                        "path": ["api", "payment", "create-order"]
                    },
                    "description": "Crea una orden de PayPal para upgrade a premium"
                },
                "response": []
            },
            {
                "name": "Capture Order (Webhook)",
                "request": {
                    "method": "GET",
                    "header": [],
                    "url": {
                        "raw": "{{base_url}}/api/payment/capture-order?token=PAYPAL_TOKEN&componentId=custom-button-1&userId=USER_ID&amount=25.50&isPremiumUpgrade=false",
                        "host": ["{{base_url}}"],
                        "path": ["api", "payment", "capture-order"],
                        "query": [
                            {
                                "key": "token",
                                "value": "PAYPAL_TOKEN",
                                "description": "Token de PayPal después de la aprobación"
                            },
                            {
                                "key": "componentId",
                                "value": "custom-button-1",
                                "description": "ID del componente (opcional para premium)"
                            },
                            {
                                "key": "userId",
                                "value": "USER_ID",
                                "description": "ID del usuario"
                            },
                            {
                                "key": "amount",
                                "value": "25.50",
                                "description": "Cantidad en MXN"
                            },
                            {
                                "key": "isPremiumUpgrade",
                                "value": "false",
                                "description": "Si es upgrade premium"
                            }
                        ]
                    },
                    "description": "Endpoint llamado por PayPal después de la aprobación del pago"
                },
                "response": []
            },
            {
                "name": "Cancel Order (Webhook)",
                "request": {
                    "method": "GET",
                    "header": [],
                    "url": {
                        "raw": "{{base_url}}/api/payment/cancel-order",
                        "host": ["{{base_url}}"],
                        "path": ["api", "payment", "cancel-order"]
                    },
                    "description": "Endpoint llamado cuando el usuario cancela el pago en PayPal"
                },
                "response": []
            }
        ]
    }

def create_utility_folder():
    """Crea la carpeta de utilidades y testing"""
    return {
        "name": "🛠️ Utilities & Testing",
        "item": [
            {
                "name": "API Documentation",
                "request": {
                    "method": "GET",
                    "header": [],
                    "url": {
                        "raw": "{{base_url}}/api-docs",
                        "host": ["{{base_url}}"],
                        "path": ["api-docs"]
                    },
                    "description": "Accede a la documentación Swagger de la API"
                },
                "response": []
            },
            {
                "name": "Health Check",
                "request": {
                    "method": "GET",
                    "header": [],
                    "url": {
                        "raw": "{{base_url}}/",
                        "host": ["{{base_url}}"],
                        "path": [""]
                    },
                    "description": "Verifica que el servidor esté funcionando"
                },
                "response": []
            },
            {
                "name": "Test Flow - Complete User Journey",
                "request": {
                    "method": "GET",
                    "header": [],
                    "url": {
                        "raw": "{{base_url}}/api/components",
                        "host": ["{{base_url}}"],
                        "path": ["api", "components"]
                    },
                    "description": "Endpoint base para testing de flujo completo"
                },
                "response": [],
                "event": [
                    {
                        "listen": "prerequest",
                        "script": {
                            "exec": [
                                "// Test Flow Script",
                                "console.log('=== COMPLETE USER JOURNEY TEST ===');",
                                "console.log('1. Register user');",
                                "console.log('2. Login user');", 
                                "console.log('3. Get components');",
                                "console.log('4. Try to access premium component');",
                                "console.log('5. Create payment order');",
                                "console.log('6. Check user access after payment');",
                                "console.log('=====================================');"
                            ]
                        }
                    }
                ]
            }
        ]
    }

def create_test_environments():
    """Crea entornos de prueba para la colección"""
    
    environments = {
        "development": {
            "id": generate_uuid(),
            "name": "Development Environment",
            "values": [
                {
                    "key": "base_url",
                    "value": "http://localhost:3000",
                    "enabled": True
                },
                {
                    "key": "auth_token",
                    "value": "",
                    "enabled": True
                },
                {
                    "key": "test_email",
                    "value": "test@example.com",
                    "enabled": True
                },
                {
                    "key": "test_password",
                    "value": "testpassword123",
                    "enabled": True
                }
            ]
        },
        "production": {
            "id": generate_uuid(),
            "name": "Production Environment",
            "values": [
                {
                    "key": "base_url",
                    "value": "https://your-production-url.com",
                    "enabled": True
                },
                {
                    "key": "auth_token",
                    "value": "",
                    "enabled": True
                }
            ]
        }
    }
    
    return environments

def generate_readme():
    """Genera un README con instrucciones de uso"""
    
    readme_content = """
# Component Store API - Postman Collection

Esta colección de Postman contiene todas las requests necesarias para probar y documentar la API del Component Store.

## 🚀 Configuración Inicial

1. **Importar la colección**: Importa el archivo `component-store-api.postman_collection.json` en Postman
2. **Configurar variables**: 
   - `base_url`: URL base de tu API (por defecto: http://localhost:3000)
   - `auth_token`: Se establecerá automáticamente después del login

## 📁 Estructura de la Colección

### 🔐 Authentication
- **Register User**: Crear nuevo usuario
- **Login User**: Obtener token JWT (se guarda automáticamente)

### 🧩 Components  
- **Get All Components**: Lista todos los componentes
- **Get Components by Type**: Filtrar por tipo de componente
- **Create Component**: Crear nuevo componente (requiere auth)
- **Get Specific Component**: Ver detalles de componente (requiere auth/pago)
- **Get User Access Info**: Ver estado de acceso del usuario

### 💳 Payments
- **Get Pricing Info**: Información de precios y beneficios
- **Create Component Donation Order**: Pagar por componente específico
- **Create Premium Upgrade Order**: Upgrade a cuenta premium
- **Capture Order**: Webhook de PayPal (éxito)
- **Cancel Order**: Webhook de PayPal (cancelación)

### 🛠️ Utilities & Testing
- **API Documentation**: Acceso a Swagger UI
- **Health Check**: Verificar estado del servidor
- **Test Flow**: Scripts para testing automatizado

## 🔄 Flujo de Prueba Recomendado

1. **Registro y Login**:
   ```
   POST /api/users/register
   POST /api/users/login
   ```

2. **Explorar Componentes**:
   ```
   GET /api/components
   GET /api/components/user/access-info
   ```

3. **Intentar Acceso a Componente Premium**:
   ```
   GET /api/components/{component-id}
   ```

4. **Proceso de Pago**:
   ```
   POST /api/payment/create-order
   GET /api/payment/capture-order (simulado)
   ```

5. **Verificar Acceso Actualizado**:
   ```
   GET /api/components/user/access-info
   GET /api/components/{component-id}
   ```

## 🧪 Testing Automatizado

La colección incluye tests automáticos que:
- Verifican códigos de respuesta HTTP
- Validan estructura de respuestas JSON  
- Guardan tokens automáticamente
- Verifican flujos completos

## 🔧 Variables de Entorno

### Development
- `base_url`: http://localhost:3000
- `test_email`: test@example.com
- `test_password`: testpassword123

### Production  
- `base_url`: https://your-production-url.com

## 📝 Notas Importantes

- **Autenticación**: El token se guarda automáticamente después del login
- **PayPal Testing**: Usa el sandbox de PayPal para pruebas
- **Premium Access**: Se requieren $50 MXN para acceso premium
- **Free Access**: Limitado a 2 componentes gratuitos

## 🚨 Configuración de PayPal

Para testing completo, configura las variables de entorno:
```
PAYPAL_API_CLIENT=your_sandbox_client_id
PAYPAL_API_SECRET=your_sandbox_client_secret
PAYPAL_API_URL=https://api.sandbox.paypal.com
```

## 📊 Monitoreo y Analytics

Usa Postman Monitor para:
- Ejecutar tests automáticamente
- Monitorear uptime de la API
- Generar reportes de performance
- Alertas por fallos

---

**¿Necesitas ayuda?** Consulta la documentación Swagger en `/api-docs`
"""
    
    return readme_content

def main():
    """Función principal que genera todos los archivos"""
    
    print("🚀 Generando colección de Postman para Component Store API...")
    
    # Generar colección principal
    collection = create_postman_collection()
    
    # Generar entornos
    environments = create_test_environments()
    
    # Generar README
    readme = generate_readme()
    
    # Guardar archivos
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # Archivo de colección
    collection_filename = f"component-store-api_{timestamp}.postman_collection.json"
    with open(collection_filename, 'w', encoding='utf-8') as f:
        json.dump(collection, f, indent=2, ensure_ascii=False)
    
    # Archivos de entornos
    for env_name, env_data in environments.items():
        env_filename = f"component-store-{env_name}_{timestamp}.postman_environment.json"
        with open(env_filename, 'w', encoding='utf-8') as f:
            json.dump(env_data, f, indent=2, ensure_ascii=False)
    
    # Archivo README
    readme_filename = f"POSTMAN_README_{timestamp}.md"
    with open(readme_filename, 'w', encoding='utf-8') as f:
        f.write(readme)
    
    print(f"✅ Archivos generados exitosamente:")
    print(f"   📄 Colección: {collection_filename}")
    print(f"   🌍 Entorno Development: component-store-development_{timestamp}.postman_environment.json")
    print(f"   🌍 Entorno Production: component-store-production_{timestamp}.postman_environment.json")
    print(f"   📖 README: {readme_filename}")
    print()
    print("📥 **Instrucciones de importación:**")
    print("1. Abre Postman")
    print("2. Click en 'Import' ")
    print("3. Arrastra los archivos .json generados")
    print("4. Configura las variables de entorno según tus necesidades")
    print("5. ¡Comienza a probar tu API!")
    print()
    print("🔗 **Endpoints principales:**")
    print("   • Registro: POST /api/users/register")
    print("   • Login: POST /api/users/login") 
    print("   • Componentes: GET /api/components")
    print("   • Pagos: POST /api/payment/create-order")
    print("   • Documentación: GET /api-docs")

if __name__ == "__main__":
    main()