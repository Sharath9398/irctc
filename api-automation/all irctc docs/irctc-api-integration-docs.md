# IRCTC API Integration Guide - Complete Developer Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture Overview](#architecture-overview)
3. [Authentication System](#authentication-system)
4. [API Categories](#api-categories)
5. [Complete Booking Flow](#complete-booking-flow)
6. [C# Implementation Examples](#c-implementation-examples)
7. [Error Handling & Retry Logic](#error-handling--retry-logic)
8. [Payment Gateway Integration](#payment-gateway-integration)
9. [Security Best Practices](#security-best-practices)
10. [Testing & Debugging](#testing--debugging)

---

## Overview

This comprehensive guide covers all APIs used in IRCTC train booking automation, including license validation, train search, booking, payment processing (Paytm, WPS, eWallet), and PNR retrieval.

### System Components
1. **License & Authentication** - License validation and captcha solving
2. **IRCTC Booking APIs** - Train search, availability, passenger input
3. **Payment Gateways** - WPS, Paytm, eWallet integration
4. **Utility APIs** - PNR status, booking history

### Technology Stack
- **Language**: C# (.NET Framework/Core)
- **HTTP Client**: HttpClient with cookie management
- **JSON Processing**: Newtonsoft.Json
- **WebView2**: For payment gateway redirects
- **Async/Await**: For non-blocking API calls

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     IRCTC Booking System                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────┐      ┌──────────────┐                   │
│  │   License     │──────│   Captcha    │                   │
│  │  Validation   │      │   Solving    │                   │
│  └───────────────┘      └──────────────┘                   │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────────────────────────────────────┐           │
│  │        IRCTC Authentication Layer           │           │
│  │  (Bearer Token, CSRF, Refresh Token, GREQ)  │           │
│  └─────────────────────────────────────────────┘           │
│         │                                                   │
│         ▼                                                   │
│  ┌───────────────┐  ┌───────────────┐  ┌──────────────┐   │
│  │ Train Search  │  │  Availability │  │   Boarding   │   │
│  │     API       │  │   Check API   │  │  Station API │   │
│  └───────────────┘  └───────────────┘  └──────────────┘   │
│         │                   │                   │          │
│         └───────────────────┴───────────────────┘          │
│                             │                              │
│                             ▼                              │
│                    ┌─────────────────┐                     │
│                    │  Passenger      │                     │
│                    │  Input API      │                     │
│                    └─────────────────┘                     │
│                             │                              │
│                             ▼                              │
│                    ┌─────────────────┐                     │
│                    │ Captcha Submit  │                     │
│                    │  (Addon API)    │                     │
│                    └─────────────────┘                     │
│                             │                              │
│                             ▼                              │
│  ┌──────────────────────────────────────────────────┐     │
│  │           Payment Gateway Selection              │     │
│  │  (eWallet / WPS / Paytm / PayU / PhonePe)        │     │
│  └──────────────────────────────────────────────────┘     │
│         │                   │                   │          │
│         ▼                   ▼                   ▼          │
│  ┌──────────┐      ┌────────────┐      ┌──────────┐      │
│  │ eWallet  │      │    WPS     │      │  Paytm   │      │
│  │  Direct  │      │  Redirect  │      │   UPI    │      │
│  └──────────┘      └────────────┘      └──────────┘      │
│         │                   │                   │          │
│         └───────────────────┴───────────────────┘          │
│                             │                              │
│                             ▼                              │
│                    ┌─────────────────┐                     │
│                    │  Payment Verify │                     │
│                    │   & PNR Status  │                     │
│                    └─────────────────┘                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Authentication System

### Authentication Token Types

IRCTC uses multiple tokens for security:

| Token | Header | Purpose | Lifespan |
|-------|--------|---------|----------|
| Access Token | `authorization: Bearer {token}` | Primary authentication | 30 minutes |
| Refresh Token | `bmiyek: {token}` | Token refresh | Session |
| GREQ Token | `greq: {token}` | Request validation | Session |
| CSRF Token | `spa-csrf-token: {token}` | CSRF protection | Request-specific |
| Cookie Session | Cookie header | Session management | Until logout |

### C# Token Management Class

```csharp
public class IRCTCAuthManager
{
    public string AccessToken { get; set; }
    public string RefreshToken { get; set; }
    public string GreqToken { get; set; }
    public string CsrfToken { get; set; }
    public CookieContainer Cookies { get; set; }
    public DateTime TokenExpiry { get; set; }

    private readonly HttpClient httpClient;
    private readonly HttpClientHandler handler;

    public IRCTCAuthManager()
    {
        handler = new HttpClientHandler
        {
            CookieContainer = new CookieContainer(),
            UseCookies = true,
            AllowAutoRedirect = true
        };
        
        httpClient = new HttpClient(handler)
        {
            Timeout = TimeSpan.FromSeconds(30)
        };
        
        Cookies = handler.CookieContainer;
    }

    public async Task<bool> ValidateAndRefreshTokenAsync()
    {
        try
        {
            var request = new HttpRequestMessage(HttpMethod.Get,
                "https://www.irctc.co.in/eticketing/protected/mapps1/validateUser?source=3");

            AddStandardHeaders(request);

            var response = await httpClient.SendAsync(request);
            
            if (response.IsSuccessStatusCode)
            {
                // Extract new tokens from response headers
                ExtractTokensFromResponse(response);
                TokenExpiry = DateTime.Now.AddMinutes(25); // Refresh before 30-min expiry
                return true;
            }

            return false;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Token validation failed: {ex.Message}");
            return false;
        }
    }

    public void AddStandardHeaders(HttpRequestMessage request)
    {
        request.Headers.Add("accept", "application/json, text/plain, */*");
        request.Headers.Add("authorization", $"Bearer {AccessToken}");
        request.Headers.Add("bmiyek", RefreshToken);
        request.Headers.Add("greq", GreqToken);
        request.Headers.Add("bmirak", "webbm");
        request.Headers.Add("X-Requested-With", "XMLHttpRequest");
        
        if (!string.IsNullOrEmpty(CsrfToken))
        {
            request.Headers.Add("spa-csrf-token", CsrfToken);
        }
    }

    private void ExtractTokensFromResponse(HttpResponseMessage response)
    {
        // Extract CSRF token from response headers
        if (response.Headers.TryGetValues("spa-csrf-token", out var csrfValues))
        {
            CsrfToken = csrfValues.FirstOrDefault();
        }

        // Extract other tokens if present in response
        // Implementation depends on IRCTC response structure
    }

    public bool IsTokenExpired()
    {
        return DateTime.Now >= TokenExpiry;
    }

    public void Dispose()
    {
        httpClient?.Dispose();
        handler?.Dispose();
    }
}
```

---

## API Categories

### 1. License & Authentication APIs

#### License Validation

```csharp
public class LicenseManager
{
    private readonly HttpClient httpClient;
    private string licenseKey;
    private string deviceId;

    public LicenseManager(string license, string device)
    {
        httpClient = new HttpClient();
        licenseKey = license;
        deviceId = device;
    }

    public async Task<bool> ValidateLicenseAsync()
    {
        try
        {
            var payload = new
            {
                key = licenseKey,
                Machine = deviceId
            };

            var content = new StringContent(
                JsonConvert.SerializeObject(payload),
                Encoding.UTF8,
                "application/json"
            );

            var response = await httpClient.PostAsync(
                "https://verifytool.in/api/validate",
                content
            );

            if (response.IsSuccessStatusCode)
            {
                var result = await response.Content.ReadAsStringAsync();
                var licenseData = JsonConvert.DeserializeObject<dynamic>(result);
                return licenseData?.status == "valid";
            }

            return false;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"License validation error: {ex.Message}");
            return false;
        }
    }
}
```

#### Captcha Solving

```csharp
public class CaptchaSolver
{
    private readonly HttpClient httpClient;
    private readonly string bookToken;

    public CaptchaSolver(string token)
    {
        httpClient = new HttpClient();
        bookToken = token;
    }

    public async Task<string> SolveCaptchaAsync(string base64Image)
    {
        try
        {
            var payload = new
            {
                imageContent = base64Image
            };

            var request = new HttpRequestMessage(HttpMethod.Post,
                "https://api.verifyotp.xyz/api/solve")
            {
                Content = new StringContent(
                    JsonConvert.SerializeObject(payload),
                    Encoding.UTF8,
                    "application/json"
                )
            };

            request.Headers.Add("X-Auth-Token", bookToken);

            var response = await httpClient.SendAsync(request);
            
            if (response.IsSuccessStatusCode)
            {
                var result = await response.Content.ReadAsStringAsync();
                var captchaData = JsonConvert.DeserializeObject<dynamic>(result);
                return captchaData?.solution?.ToString();
            }

            return null;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Captcha solving error: {ex.Message}");
            return null;
        }
    }
}
```

---

### 2. IRCTC Booking APIs

#### Train Availability Search

```csharp
public class TrainBookingAPI
{
    private readonly IRCTCAuthManager authManager;
    private readonly HttpClient httpClient;

    public TrainBookingAPI(IRCTCAuthManager auth)
    {
        authManager = auth;
        
        var handler = new HttpClientHandler
        {
            CookieContainer = authManager.Cookies,
            UseCookies = true
        };
        
        httpClient = new HttpClient(handler);
    }

    public async Task<List<TrainAvailability>> GetAlternativeTrainsAsync(
        string fromStation,
        string toStation,
        string journeyClass,
        string journeyDate,
        string quotaCode = "GN")
    {
        try
        {
            // Validate/refresh token if needed
            if (authManager.IsTokenExpired())
            {
                await authManager.ValidateAndRefreshTokenAsync();
            }

            var payload = new
            {
                concessionBooking = false,
                srcStn = fromStation,
                destStn = toStation,
                jrnyClass = journeyClass,
                jrnyDate = journeyDate, // Format: YYYYMMDD (e.g., "20250115")
                quotaCode = quotaCode,
                ticketType = "E",
                currentBooking = "false",
                flexiFlag = false,
                ftBooking = false,
                handicapFlag = false,
                loyaltyRedemptionBooking = false
            };

            var request = new HttpRequestMessage(HttpMethod.Post,
                "https://www.irctc.co.in/eticketing/protected/mapps1/altAvlEnq/TC")
            {
                Content = new StringContent(
                    JsonConvert.SerializeObject(payload),
                    Encoding.UTF8,
                    "application/json"
                )
            };

            authManager.AddStandardHeaders(request);

            var response = await httpClient.SendAsync(request);
            response.EnsureSuccessStatusCode();

            var jsonResponse = await response.Content.ReadAsStringAsync();
            var data = JsonConvert.DeserializeObject<AlternativeTrainsResponse>(jsonResponse);

            return data?.data ?? new List<TrainAvailability>();
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Train search error: {ex.Message}");
            throw;
        }
    }

    public async Task<FareEnquiryResponse> GetAvailabilityAndFareAsync(
        string trainNumber,
        string journeyDate,
        string fromStation,
        string toStation,
        string classCode,
        string quotaCode = "GN")
    {
        try
        {
            var payload = new
            {
                paymentFlag = "N",
                concessionBooking = false,
                ftBooking = false,
                loyaltyRedemptionBooking = false,
                ticketType = "E",
                classCode = classCode,
                fromStnCode = fromStation,
                toStnCode = toStation,
                quotaCode = quotaCode,
                trainNumber = trainNumber,
                journeyDate = journeyDate,
                isLogedinReq = true,
                moreThanOneDay = true
            };

            var request = new HttpRequestMessage(HttpMethod.Post,
                $"https://www.irctc.co.in/eticketing/protected/mapps1/avlFarenquiry/{trainNumber}/{journeyDate}/{fromStation}/{toStation}/{classCode}/{quotaCode}/N")
            {
                Content = new StringContent(
                    JsonConvert.SerializeObject(payload),
                    Encoding.UTF8,
                    "application/json"
                )
            };

            authManager.AddStandardHeaders(request);

            var response = await httpClient.SendAsync(request);
            response.EnsureSuccessStatusCode();

            var jsonResponse = await response.Content.ReadAsStringAsync();
            return JsonConvert.DeserializeObject<FareEnquiryResponse>(jsonResponse);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Fare enquiry error: {ex.Message}");
            throw;
        }
    }

    public async Task<BoardingStationResponse> GetBoardingStationsAsync(
        string trainNumber,
        string fromStation,
        string toStation,
        string journeyClass,
        string journeyDate,
        string quotaCode = "GN")
    {
        try
        {
            var payload = new
            {
                alternateAvlInputDTO = new[]
                {
                    new
                    {
                        trainNo = trainNumber,
                        destStn = toStation,
                        srcStn = fromStation,
                        jrnyDate = journeyDate,
                        quotaCode = quotaCode,
                        jrnyClass = journeyClass
                    }
                },
                concessionPassengers = false,
                destStn = toStation,
                jrnyClass = journeyClass,
                jrnyDate = journeyDate,
                quotaCode = quotaCode,
                srcStn = fromStation,
                trainNo = trainNumber,
                autoUpgradationSelected = false,
                captureAddress = 0,
                clusterFlag = "N",
                cod = "false",
                gnToCkOpted = false,
                journalistBooking = false,
                onwardFlag = "N",
                passBooking = false,
                paymentType = 1,
                reservationMode = "WS_TA_B2C",
                twoPhaseAuthRequired = false
            };

            var request = new HttpRequestMessage(HttpMethod.Post,
                "https://www.irctc.co.in/eticketing/protected/mapps1/boardingStationEnq")
            {
                Content = new StringContent(
                    JsonConvert.SerializeObject(payload),
                    Encoding.UTF8,
                    "application/json"
                )
            };

            authManager.AddStandardHeaders(request);

            var response = await httpClient.SendAsync(request);
            response.EnsureSuccessStatusCode();

            var jsonResponse = await response.Content.ReadAsStringAsync();
            return JsonConvert.DeserializeObject<BoardingStationResponse>(jsonResponse);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Boarding station error: {ex.Message}");
            throw;
        }
    }
}
```

#### Passenger Input (Booking)

```csharp
public class BookingManager
{
    private readonly IRCTCAuthManager authManager;
    private readonly HttpClient httpClient;

    public BookingManager(IRCTCAuthManager auth)
    {
        authManager = auth;
        
        var handler = new HttpClientHandler
        {
            CookieContainer = authManager.Cookies,
            UseCookies = true
        };
        
        httpClient = new HttpClient(handler);
    }

    public async Task<BookingResponse> SubmitPassengerDetailsAsync(
        BookingRequest bookingData)
    {
        try
        {
            // Generate unique client transaction ID
            string clientTxnId = GenerateClientTransactionId();
            bookingData.clientTransactionId = clientTxnId;

            var request = new HttpRequestMessage(HttpMethod.Post,
                "https://www.irctc.co.in/eticketing/protected/mapps1/allLapAvlFareEnq/Y")
            {
                Content = new StringContent(
                    JsonConvert.SerializeObject(bookingData),
                    Encoding.UTF8,
                    "application/json"
                )
            };

            authManager.AddStandardHeaders(request);
            request.Headers.Add("referer", "https://www.irctc.co.in/nget/booking/psgninput");

            var response = await httpClient.SendAsync(request);
            response.EnsureSuccessStatusCode();

            var jsonResponse = await response.Content.ReadAsStringAsync();
            var bookingResponse = JsonConvert.DeserializeObject<BookingResponse>(jsonResponse);

            // Store client transaction ID for payment
            bookingResponse.ClientTransactionId = clientTxnId;

            return bookingResponse;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Passenger input error: {ex.Message}");
            throw;
        }
    }

    public async Task<AddonServicesResponse> SubmitCaptchaAsync(
        string clientTxnId,
        string captchaAnswer)
    {
        try
        {
            var payload = new
            {
                captchaAns = captchaAnswer,
                captchaType = "BOOKINGWS",
                clientTxnId = clientTxnId,
                paymentType = 1,
                addonLapServices = new[]
                {
                    new { travelInsuranceOpted = true }
                }
            };

            var request = new HttpRequestMessage(HttpMethod.Post,
                "https://www.irctc.co.in/eticketing/protected/mapps1/addonServices")
            {
                Content = new StringContent(
                    JsonConvert.SerializeObject(payload),
                    Encoding.UTF8,
                    "application/json"
                )
            };

            authManager.AddStandardHeaders(request);
            request.Headers.Add("referer", "https://www.irctc.co.in/nget/booking/psgninput");

            var response = await httpClient.SendAsync(request);
            response.EnsureSuccessStatusCode();

            var jsonResponse = await response.Content.ReadAsStringAsync();
            return JsonConvert.DeserializeObject<AddonServicesResponse>(jsonResponse);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Captcha submission error: {ex.Message}");
            throw;
        }
    }

    private string GenerateClientTransactionId()
    {
        // Format: YYYYMMDDHHMMSS + Random 6 digits
        var timestamp = DateTime.Now.ToString("yyyyMMddHHmmss");
        var random = new Random().Next(100000, 999999);
        return $"{timestamp}{random}";
    }
}
```

---

### 3. Payment Gateway Integration

#### Payment Initialization

```csharp
public class PaymentManager
{
    private readonly IRCTCAuthManager authManager;
    private readonly HttpClient httpClient;

    public PaymentManager(IRCTCAuthManager auth)
    {
        authManager = auth;
        
        var handler = new HttpClientHandler
        {
            CookieContainer = authManager.Cookies,
            UseCookies = true
        };
        
        httpClient = new HttpClient(handler);
    }

    // eWallet Payment
    public async Task<PaymentInitResponse> InitializeEWalletPaymentAsync(
        string clientTxnId,
        decimal amount)
    {
        try
        {
            var payload = new
            {
                bankId = 1000, // eWallet bank ID
                txnType = 7,
                paramList = new[]
                {
                    new { key = "TXN_PASSWORD", value = "" }
                },
                amount = amount.ToString("F2"),
                transationId = 0,
                txnStatus = 1
            };

            var request = new HttpRequestMessage(HttpMethod.Post,
                $"https://www.irctc.co.in/eticketing/protected/mapps1/bookingInitPayment/{clientTxnId}?insurenceApplicable=")
            {
                Content = new StringContent(
                    JsonConvert.SerializeObject(payload),
                    Encoding.UTF8,
                    "application/json"
                )
            };

            authManager.AddStandardHeaders(request);
            request.Headers.Add("referer", "https://www.irctc.co.in/nget/payment/bkgPaymentOptions");

            var response = await httpClient.SendAsync(request);
            response.EnsureSuccessStatusCode();

            var jsonResponse = await response.Content.ReadAsStringAsync();
            return JsonConvert.DeserializeObject<PaymentInitResponse>(jsonResponse);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"eWallet payment init error: {ex.Message}");
            throw;
        }
    }

    // WPS Gateway Payment (Paytm, PayU, etc.)
    public async Task<PaymentInitResponse> InitializeWPSPaymentAsync(
        string clientTxnId,
        decimal amount,
        string bankId = "78") // 78 = Paytm
    {
        try
        {
            var payload = new
            {
                clientTxnId = clientTxnId,
                bankId = bankId,
                paymentMode = "13",
                txnType = 1,
                txnStatus = 1,
                amount = amount.ToString("F2"),
                paramList = new object[] { }
            };

            var request = new HttpRequestMessage(HttpMethod.Post,
                $"https://www.irctc.co.in/eticketing/protected/mapps1/bookingInitPayment/{clientTxnId}?insurenceApplicable=")
            {
                Content = new StringContent(
                    JsonConvert.SerializeObject(payload),
                    Encoding.UTF8,
                    "application/json"
                )
            };

            authManager.AddStandardHeaders(request);
            request.Headers.Add("referer", "https://www.irctc.co.in/nget/booking/psgninput");

            var response = await httpClient.SendAsync(request);
            response.EnsureSuccessStatusCode();

            var jsonResponse = await response.Content.ReadAsStringAsync();
            return JsonConvert.DeserializeObject<PaymentInitResponse>(jsonResponse);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"WPS payment init error: {ex.Message}");
            throw;
        }
    }

    public async Task<string> RedirectToWPSGatewayAsync(
        string accessToken,
        string irctcId,
        string clientTxnId,
        string ddValue)
    {
        try
        {
            var formData = new Dictionary<string, string>
            {
                { "token", accessToken },
                { "txn", $"{irctcId}:{clientTxnId}" },
                { $"{irctcId}:{clientTxnId}", ddValue }
            };

            var content = new FormUrlEncodedContent(formData);

            var request = new HttpRequestMessage(HttpMethod.Post,
                "https://www.wps.irctc.co.in/eticketing/PaymentRedirect")
            {
                Content = content
            };

            request.Headers.Add("Referer", "https://www.irctc.co.in/");

            var response = await httpClient.SendAsync(request);
            var htmlContent = await response.Content.ReadAsStringAsync();

            // Extract payment gateway URL from HTML form
            return ExtractPaymentUrl(htmlContent);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"WPS redirect error: {ex.Message}");
            throw;
        }
    }

    private string ExtractPaymentUrl(string html)
    {
        // Parse HTML to extract form action URL
        // This would use HTML parsing library like HtmlAgilityPack
        var match = System.Text.RegularExpressions.Regex.Match(
            html,
            @"action=""([^""]+)""",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase
        );

        return match.Success ? match.Groups[1].Value : null;
    }
}
```

#### Paytm UPI Integration

```csharp
public class PaytmUPIManager
{
    private readonly HttpClient httpClient;
    private string merchantId;
    private string orderId;
    private string txnToken;

    public PaytmUPIManager(string mid, string order, string token)
    {
        httpClient = new HttpClient();
        merchantId = mid;
        orderId = order;
        txnToken = token;
    }

    public async Task<PaytmPaymentOptionsResponse> GetPaymentOptionsAsync()
    {
        try
        {
            var payload = new
            {
                head = new
                {
                    version = "v1",
                    requestTimestamp = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
                    channelId = "WEB",
                    token = txnToken,
                    tokenType = "TXN_TOKEN",
                    txnToken = txnToken,
                    workFlow = "NATIVE",
                    showLoader = true
                },
                body = new
                {
                    mid = merchantId,
                    orderId = orderId,
                    payMethods = new[]
                    {
                        new
                        {
                            payMethod = "UPI",
                            payOption = "UPI",
                            upiModeSubTypes = new[] { "UPI_COLLECT", "UPI_INTENT", "UPI_QR" }
                        }
                    }
                }
            };

            var request = new HttpRequestMessage(HttpMethod.Post,
                $"https://secure.paytmpayments.com/pg/v1/pay/{merchantId}/{orderId}")
            {
                Content = new StringContent(
                    JsonConvert.SerializeObject(payload),
                    Encoding.UTF8,
                    "application/json"
                )
            };

            request.Headers.Add("Referer", "https://secure.paytmpayments.com/");

            var response = await httpClient.SendAsync(request);
            response.EnsureSuccessStatusCode();

            var jsonResponse = await response.Content.ReadAsStringAsync();
            return JsonConvert.DeserializeObject<PaytmPaymentOptionsResponse>(jsonResponse);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Paytm options error: {ex.Message}");
            throw;
        }
    }

    public async Task<bool> ValidateVPAAsync(string vpaAddress)
    {
        try
        {
            var payload = new
            {
                head = new
                {
                    version = "v1",
                    requestTimestamp = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
                    channelId = "WEB",
                    workFlow = "NATIVE",
                    tokenType = "TXN_TOKEN",
                    token = txnToken,
                    txnToken = txnToken
                },
                body = new
                {
                    vpa = vpaAddress,
                    mid = merchantId,
                    orderId = orderId
                }
            };

            var request = new HttpRequestMessage(HttpMethod.Post,
                $"https://secure.paytmpayments.com/pg/v1/pay/{merchantId}/{orderId}/validateVpa")
            {
                Content = new StringContent(
                    JsonConvert.SerializeObject(payload),
                    Encoding.UTF8,
                    "application/json"
                )
            };

            request.Headers.Add("Referer", "https://secure.paytmpayments.com/");

            var response = await httpClient.SendAsync(request);
            response.EnsureSuccessStatusCode();

            var jsonResponse = await response.Content.ReadAsStringAsync();
            var result = JsonConvert.DeserializeObject<dynamic>(jsonResponse);

            return result?.body?.resultInfo?.resultStatus == "SUCCESS";
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"VPA validation error: {ex.Message}");
            return false;
        }
    }

    public async Task<PaytmTransactionResponse> ProcessUPITransactionAsync(
        string vpaAddress,
        decimal amount)
    {
        try
        {
            var payload = new
            {
                head = new
                {
                    version = "v1",
                    channelId = "WEB",
                    workFlow = "NATIVE",
                    tokenType = "TXN_TOKEN",
                    requestTimestamp = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
                    txnToken = txnToken,
                    token = txnToken
                },
                body = new
                {
                    paymentMode = "UPI",
                    requestType = "NATIVE",
                    authMode = "3D",
                    paymentFlow = "UPI_COLLECT",
                    selectedPaymentModeId = 2,
                    payerAccount = vpaAddress,
                    mid = merchantId,
                    orderId = orderId,
                    riskExtendInfo = $"amount={amount:F2}"
                },
                showPostFetchLoader = false
            };

            var request = new HttpRequestMessage(HttpMethod.Post,
                $"https://secure.paytmpayments.com/pg/v1/pay/{merchantId}/{orderId}/processTransaction")
            {
                Content = new StringContent(
                    JsonConvert.SerializeObject(payload),
                    Encoding.UTF8,
                    "application/json"
                )
            };

            request.Headers.Add("Referer", "https://secure.paytmpayments.com/");

            var response = await httpClient.SendAsync(request);
            response.EnsureSuccessStatusCode();

            var jsonResponse = await response.Content.ReadAsStringAsync();
            return JsonConvert.DeserializeObject<PaytmTransactionResponse>(jsonResponse);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"UPI transaction error: {ex.Message}");
            throw;
        }
    }

    public async Task<PaytmStatusResponse> PollTransactionStatusAsync(
        string transactionId,
        string cashierRequestId)
    {
        try
        {
            var formData = new Dictionary<string, string>
            {
                { "MID", merchantId },
                { "ORDER_ID", orderId },
                { "merchantId", merchantId },
                { "orderId", orderId },
                { "transId", transactionId },
                { "cashierRequestId", cashierRequestId },
                { "paymentMode", "UPI" },
                { "vpaID", "user@paytm" }, // Replace with actual VPA
                { "isSelfPush", "false" },
                { "upiAccepted", "true" },
                { "STATUS_INTERVAL", "3000" },
                { "STATUS_TIMEOUT", "300000" }
            };

            var content = new FormUrlEncodedContent(formData);

            var response = await httpClient.PostAsync(
                $"https://secure.paytmpayments.com/pg/v1/status/{merchantId}/{orderId}",
                content
            );

            var jsonResponse = await response.Content.ReadAsStringAsync();
            return JsonConvert.DeserializeObject<PaytmStatusResponse>(jsonResponse);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Status poll error: {ex.Message}");
            throw;
        }
    }
}
```

---

## Complete Booking Flow

### End-to-End Booking Implementation

```csharp
public class IRCTCBookingOrchestrator
{
    private readonly LicenseManager licenseManager;
    private readonly CaptchaSolver captchaSolver;
    private readonly IRCTCAuthManager authManager;
    private readonly TrainBookingAPI trainAPI;
    private readonly BookingManager bookingManager;
    private readonly PaymentManager paymentManager;

    public async Task<BookingResult> ExecuteCompleteBookingAsync(
        BookingRequestData bookingData)
    {
        try
        {
            // Step 1: Validate License
            Console.WriteLine("Step 1: Validating license...");
            bool isLicenseValid = await licenseManager.ValidateLicenseAsync();
            if (!isLicenseValid)
            {
                return new BookingResult { Success = false, Message = "Invalid license" };
            }

            // Step 2: Validate/Refresh IRCTC Tokens
            Console.WriteLine("Step 2: Validating authentication tokens...");
            if (authManager.IsTokenExpired())
            {
                await authManager.ValidateAndRefreshTokenAsync();
            }

            // Step 3: Search for Trains
            Console.WriteLine("Step 3: Searching for available trains...");
            var trains = await trainAPI.GetAlternativeTrainsAsync(
                bookingData.FromStation,
                bookingData.ToStation,
                bookingData.JourneyClass,
                bookingData.JourneyDate
            );

            if (!trains.Any())
            {
                return new BookingResult { Success = false, Message = "No trains available" };
            }

            // Step 4: Get Fare & Availability
            Console.WriteLine("Step 4: Checking fare and availability...");
            var fareInfo = await trainAPI.GetAvailabilityAndFareAsync(
                bookingData.TrainNumber,
                bookingData.JourneyDate,
                bookingData.FromStation,
                bookingData.ToStation,
                bookingData.JourneyClass
            );

            if (!fareInfo.IsAvailable)
            {
                return new BookingResult { Success = false, Message = "Train not available" };
            }

            // Step 5: Get Boarding Stations
            Console.WriteLine("Step 5: Fetching boarding stations...");
            var boardingInfo = await trainAPI.GetBoardingStationsAsync(
                bookingData.TrainNumber,
                bookingData.FromStation,
                bookingData.ToStation,
                bookingData.JourneyClass,
                bookingData.JourneyDate
            );

            // Step 6: Submit Passenger Details
            Console.WriteLine("Step 6: Submitting passenger details...");
            var bookingRequest = CreateBookingRequest(bookingData, fareInfo, boardingInfo);
            var bookingResponse = await bookingManager.SubmitPassengerDetailsAsync(bookingRequest);

            if (!bookingResponse.Success)
            {
                return new BookingResult { Success = false, Message = "Passenger input failed" };
            }

            // Step 7: Solve Captcha
            Console.WriteLine("Step 7: Solving captcha...");
            string captchaImage = bookingResponse.CaptchaImage; // Base64 image
            string captchaSolution = await captchaSolver.SolveCaptchaAsync(captchaImage);

            if (string.IsNullOrEmpty(captchaSolution))
            {
                return new BookingResult { Success = false, Message = "Captcha solving failed" };
            }

            // Step 8: Submit Captcha
            Console.WriteLine("Step 8: Submitting captcha...");
            var addonResponse = await bookingManager.SubmitCaptchaAsync(
                bookingResponse.ClientTransactionId,
                captchaSolution
            );

            if (!addonResponse.Success)
            {
                return new BookingResult { Success = false, Message = "Captcha submission failed" };
            }

            // Step 9: Initialize Payment
            Console.WriteLine("Step 9: Initializing payment...");
            PaymentInitResponse paymentInit;

            if (bookingData.PaymentMethod == "EWALLET")
            {
                paymentInit = await paymentManager.InitializeEWalletPaymentAsync(
                    bookingResponse.ClientTransactionId,
                    fareInfo.TotalFare
                );
            }
            else
            {
                paymentInit = await paymentManager.InitializeWPSPaymentAsync(
                    bookingResponse.ClientTransactionId,
                    fareInfo.TotalFare,
                    bookingData.BankId
                );
            }

            // Step 10: Process Payment
            Console.WriteLine("Step 10: Processing payment...");
            var paymentResult = await ProcessPaymentAsync(
                paymentInit,
                bookingData,
                bookingResponse.ClientTransactionId
            );

            if (!paymentResult.Success)
            {
                return new BookingResult 
                { 
                    Success = false, 
                    Message = "Payment failed: " + paymentResult.Message 
                };
            }

            // Step 11: Verify Payment & Get PNR
            Console.WriteLine("Step 11: Verifying payment and retrieving PNR...");
            var pnrResult = await VerifyPaymentAndGetPNRAsync(
                bookingResponse.ClientTransactionId,
                paymentResult.TransactionId
            );

            return new BookingResult
            {
                Success = true,
                PNR = pnrResult.PNR,
                Message = "Booking successful!",
                BookingDetails = pnrResult
            };
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Booking failed: {ex.Message}");
            return new BookingResult 
            { 
                Success = false, 
                Message = $"Exception: {ex.Message}" 
            };
        }
    }

    private BookingRequest CreateBookingRequest(
        BookingRequestData data,
        FareEnquiryResponse fareInfo,
        BoardingStationResponse boardingInfo)
    {
        return new BookingRequest
        {
            autoUpgradationSelected = false,
            boardingStation = data.BoardingStation ?? data.FromStation,
            bookOnlyIfCnf = true,
            bookingChoice = 1,
            bookingConfirmChoice = 1,
            captcha = "",
            captureAddress = 0,
            clusterFlag = "N",
            cod = "false",
            connectingJourney = false,
            ftBooking = false,
            gnToCkOpted = false,
            gstDetails = new { error = (string)null, gstIn = "" },
            lapAvlRequestDTO = new[]
            {
                new LapAvlRequest
                {
                    autoUpgradation = false,
                    bookOnlyIfCnf = true,
                    fromStation = data.FromStation,
                    ignoreChoiceIfWl = false,
                    journeyClass = data.JourneyClass,
                    journeyDate = data.JourneyDate,
                    passengerList = data.Passengers,
                    quota = "GN",
                    reservationChoice = 1,
                    toStation = data.ToStation,
                    trainNo = data.TrainNumber,
                    travelInsuranceOpted = "true",
                    warrentType = 0
                }
            },
            mobileNumber = data.MobileNumber,
            moreThanOneDay = false,
            paymentType = 1,
            reservationMode = "WS_TA_B2C",
            reservationUptoStation = data.ToStation,
            ticketType = "E",
            wsUserLogin = data.IRCTCUsername
        };
    }

    private async Task<PaymentResult> ProcessPaymentAsync(
        PaymentInitResponse paymentInit,
        BookingRequestData bookingData,
        string clientTxnId)
    {
        if (bookingData.PaymentMethod == "PAYTM_UPI")
        {
            var paytmManager = new PaytmUPIManager(
                paymentInit.MerchantId,
                paymentInit.OrderId,
                paymentInit.TxnToken
            );

            // Get payment options
            var options = await paytmManager.GetPaymentOptionsAsync();

            // Validate VPA
            bool isValid = await paytmManager.ValidateVPAAsync(bookingData.UPIAddress);
            if (!isValid)
            {
                return new PaymentResult 
                { 
                    Success = false, 
                    Message = "Invalid UPI ID" 
                };
            }

            // Process transaction
            var txnResponse = await paytmManager.ProcessUPITransactionAsync(
                bookingData.UPIAddress,
                paymentInit.Amount
            );

            // Poll for status
            int maxPolls = 60; // 3 minutes (3 seconds interval)
            for (int i = 0; i < maxPolls; i++)
            {
                await Task.Delay(3000); // Wait 3 seconds

                var status = await paytmManager.PollTransactionStatusAsync(
                    txnResponse.TransactionId,
                    txnResponse.CashierRequestId
                );

                if (status.IsFinal)
                {
                    return new PaymentResult
                    {
                        Success = status.IsSuccess,
                        TransactionId = txnResponse.TransactionId,
                        Message = status.Message
                    };
                }
            }

            return new PaymentResult 
            { 
                Success = false, 
                Message = "Payment timeout" 
            };
        }

        return new PaymentResult 
        { 
            Success = false, 
            Message = "Payment method not implemented" 
        };
    }

    private async Task<PNRResult> VerifyPaymentAndGetPNRAsync(
        string clientTxnId,
        string transactionId)
    {
        // Verify payment on IRCTC side
        var verifyRequest = new
        {
            transationId = transactionId,
            bankId = "78",
            txnType = "1",
            txnStatus = "12",
            amount = "500.00",
            timeStamp = DateTimeOffset.Now.ToUnixTimeMilliseconds()
        };

        // Make verification request
        // ... implementation

        // Fetch PNR from booking history
        await Task.Delay(5000); // Wait for IRCTC to process

        // Get booking history to retrieve PNR
        // ... implementation

        return new PNRResult
        {
            PNR = "1234567890",
            Status = "CNF",
            TrainNumber = "12301",
            BookingDate = DateTime.Now
        };
    }
}
```

---

## Data Models

```csharp
// Request Models
public class BookingRequestData
{
    public string FromStation { get; set; }
    public string ToStation { get; set; }
    public string JourneyClass { get; set; }
    public string JourneyDate { get; set; } // YYYYMMDD
    public string TrainNumber { get; set; }
    public string BoardingStation { get; set; }
    public string MobileNumber { get; set; }
    public string IRCTCUsername { get; set; }
    public List<Passenger> Passengers { get; set; }
    public string PaymentMethod { get; set; } // EWALLET, PAYTM_UPI, WPS
    public string BankId { get; set; }
    public string UPIAddress { get; set; }
}

public class Passenger
{
    public string passengerName { get; set; }
    public int passengerAge { get; set; }
    public string passengerGender { get; set; } // M, F, T
    public string passengerNationality { get; set; } // IN
    public int passengerSerialNumber { get; set; }
    public bool passengerIcardFlag { get; set; }
    public string passengerCardType { get; set; } // NULL_IDCARD
    public string passengerBerthChoice { get; set; } // LB, UB, MB, SL, SU
    public bool childBerthFlag { get; set; }
}

// Response Models
public class TrainAvailability
{
    public string TrainNumber { get; set; }
    public string TrainName { get; set; }
    public string DepartureTime { get; set; }
    public string ArrivalTime { get; set; }
    public string Duration { get; set; }
    public string AvailabilityStatus { get; set; }
    public decimal Fare { get; set; }
}

public class FareEnquiryResponse
{
    public bool IsAvailable { get; set; }
    public decimal TotalFare { get; set; }
    public decimal BaseFare { get; set; }
    public decimal GST { get; set; }
    public decimal InsuranceCharge { get; set; }
    public string AvailabilityStatus { get; set; }
    public List<string> AvailableClasses { get; set; }
}

public class BookingResponse
{
    public bool Success { get; set; }
    public string ClientTransactionId { get; set; }
    public string CaptchaImage { get; set; } // Base64
    public string Message { get; set; }
}

public class PaymentInitResponse
{
    public bool Success { get; set; }
    public string MerchantId { get; set; }
    public string OrderId { get; set; }
    public string TxnToken { get; set; }
    public decimal Amount { get; set; }
    public string PaymentUrl { get; set; }
}

public class BookingResult
{
    public bool Success { get; set; }
    public string PNR { get; set; }
    public string Message { get; set; }
    public PNRResult BookingDetails { get; set; }
}

public class PNRResult
{
    public string PNR { get; set; }
    public string Status { get; set; }
    public string TrainNumber { get; set; }
    public DateTime BookingDate { get; set; }
    public List<PassengerStatus> Passengers { get; set; }
}

public class PassengerStatus
{
    public string Name { get; set; }
    public int Age { get; set; }
    public string Gender { get; set; }
    public string Status { get; set; } // CNF, RAC, WL
    public string CoachNumber { get; set; }
    public string SeatNumber { get; set; }
}
```

---

## Error Handling & Retry Logic

```csharp
public class RetryHelper
{
    public static async Task<T> ExecuteWithRetryAsync<T>(
        Func<Task<T>> operation,
        int maxRetries = 3,
        int delayMilliseconds = 1000,
        Func<Exception, bool> shouldRetry = null)
    {
        int attempt = 0;
        Exception lastException = null;

        while (attempt < maxRetries)
        {
            try
            {
                attempt++;
                return await operation();
            }
            catch (Exception ex)
            {
                lastException = ex;
                
                // Check if we should retry this exception
                if (shouldRetry != null && !shouldRetry(ex))
                {
                    throw;
                }

                // Don't retry on last attempt
                if (attempt >= maxRetries)
                {
                    break;
                }

                // Log the retry
                System.Diagnostics.Debug.WriteLine(
                    $"Attempt {attempt} failed: {ex.Message}. Retrying in {delayMilliseconds}ms..."
                );

                // Wait before retry (exponential backoff)
                await Task.Delay(delayMilliseconds * attempt);
            }
        }

        // If we get here, all retries failed
        throw new Exception(
            $"Operation failed after {maxRetries} attempts. Last error: {lastException?.Message}",
            lastException
        );
    }
}

// Usage Example
public async Task<TrainAvailability> GetTrainWithRetryAsync(string trainNo)
{
    return await RetryHelper.ExecuteWithRetryAsync(
        async () => await trainAPI.GetAvailabilityAndFareAsync(trainNo, ...),
        maxRetries: 3,
        delayMilliseconds: 2000,
        shouldRetry: (ex) => 
        {
            // Retry on network errors but not on validation errors
            return ex is HttpRequestException || ex is TaskCanceledException;
        }
    );
}
```

---

## Security Best Practices

### 1. Secure Token Storage

```csharp
using System.Security.Cryptography;
using System.Text;

public class SecureTokenStorage
{
    private static readonly byte[] entropy = Encoding.UTF8.GetBytes("IRCTC_Token_Salt_2025");

    public static string EncryptToken(string token)
    {
        if (string.IsNullOrEmpty(token))
            return null;

        byte[] tokenBytes = Encoding.UTF8.GetBytes(token);
        byte[] encryptedBytes = ProtectedData.Protect(
            tokenBytes,
            entropy,
            DataProtectionScope.CurrentUser
        );

        return Convert.ToBase64String(encryptedBytes);
    }

    public static string DecryptToken(string encryptedToken)
    {
        if (string.IsNullOrEmpty(encryptedToken))
            return null;

        byte[] encryptedBytes = Convert.FromBase64String(encryptedToken);
        byte[] tokenBytes = ProtectedData.Unprotect(
            encryptedBytes,
            entropy,
            DataProtectionScope.CurrentUser
        );

        return Encoding.UTF8.GetString(tokenBytes);
    }
}
```

### 2. API Rate Limiting

```csharp
public class RateLimiter
{
    private readonly SemaphoreSlim semaphore;
    private readonly Queue<DateTime> requestTimes;
    private readonly int maxRequestsPerMinute;
    private readonly object lockObj = new object();

    public RateLimiter(int maxRequestsPerMinute = 30)
    {
        this.maxRequestsPerMinute = maxRequestsPerMinute;
        semaphore = new SemaphoreSlim(1, 1);
        requestTimes = new Queue<DateTime>();
    }

    public async Task WaitAsync()
    {
        await semaphore.WaitAsync();

        try
        {
            lock (lockObj)
            {
                // Remove requests older than 1 minute
                var cutoffTime = DateTime.Now.AddMinutes(-1);
                while (requestTimes.Count > 0 && requestTimes.Peek() < cutoffTime)
                {
                    requestTimes.Dequeue();
                }

                // Check if we've hit the limit
                if (requestTimes.Count >= maxRequestsPerMinute)
                {
                    var oldestRequest = requestTimes.Peek();
                    var waitTime = oldestRequest.AddMinutes(1) - DateTime.Now;
                    
                    if (waitTime.TotalMilliseconds > 0)
                    {
                        System.Diagnostics.Debug.WriteLine(
                            $"Rate limit reached. Waiting {waitTime.TotalSeconds:F1} seconds..."
                        );
                        Thread.Sleep(waitTime);
                    }

                    requestTimes.Dequeue();
                }

                requestTimes.Enqueue(DateTime.Now);
            }
        }
        finally
        {
            semaphore.Release();
        }
    }
}

// Usage
private readonly RateLimiter rateLimiter = new RateLimiter(30); // 30 requests per minute

public async Task<T> MakeAPICallAsync<T>(Func<Task<T>> apiCall)
{
    await rateLimiter.WaitAsync();
    return await apiCall();
}
```

### 3. Input Validation

```csharp
public class ValidationHelper
{
    public static bool IsValidStationCode(string code)
    {
        return !string.IsNullOrWhiteSpace(code) &&
               code.Length >= 2 &&
               code.Length <= 5 &&
               Regex.IsMatch(code, @"^[A-Z]+$");
    }

    public static bool IsValidTrainNumber(string trainNo)
    {
        return !string.IsNullOrWhiteSpace(trainNo) &&
               Regex.IsMatch(trainNo, @"^\d{5}$");
    }

    public static bool IsValidDate(string date)
    {
        // Format: YYYYMMDD
        return DateTime.TryParseExact(
            date,
            "yyyyMMdd",
            System.Globalization.CultureInfo.InvariantCulture,
            System.Globalization.DateTimeStyles.None,
            out _
        );
    }

    public static bool IsValidMobileNumber(string mobile)
    {
        return !string.IsNullOrWhiteSpace(mobile) &&
               Regex.IsMatch(mobile, @"^[6-9]\d{9}$");
    }

    public static bool IsValidUPI(string upiAddress)
    {
        return !string.IsNullOrWhiteSpace(upiAddress) &&
               Regex.IsMatch(upiAddress, @"^[\w.-]+@[\w.-]+$");
    }

    public static string SanitizeInput(string input)
    {
        if (string.IsNullOrEmpty(input))
            return input;

        // Remove potentially dangerous characters
        return Regex.Replace(input, @"[^\w\s@.-]", "");
    }
}
```

---

## Testing & Debugging

### Unit Test Example

```csharp
using NUnit.Framework;
using Moq;

[TestFixture]
public class TrainBookingAPITests
{
    private Mock<IRCTCAuthManager> mockAuthManager;
    private TrainBookingAPI trainAPI;

    [SetUp]
    public void Setup()
    {
        mockAuthManager = new Mock<IRCTCAuthManager>();
        mockAuthManager.Setup(m => m.IsTokenExpired()).Returns(false);
        mockAuthManager.Setup(m => m.AccessToken).Returns("TEST_TOKEN");
        
        trainAPI = new TrainBookingAPI(mockAuthManager.Object);
    }

    [Test]
    public async Task GetAlternativeTrains_ValidInput_ReturnsTrains()
    {
        // Arrange
        string from = "NDLS";
        string to = "BCT";
        string class = "3A";
        string date = "20250115";

        // Act
        var result = await trainAPI.GetAlternativeTrainsAsync(from, to, class, date);

        // Assert
        Assert.IsNotNull(result);
        Assert.Greater(result.Count, 0);
    }

    [Test]
    public void IsValidStationCode_ValidCode_ReturnsTrue()
    {
        // Arrange
        string validCode = "NDLS";

        // Act
        bool result = ValidationHelper.IsValidStationCode(validCode);

        // Assert
        Assert.IsTrue(result);
    }

    [Test]
    public void IsValidStationCode_InvalidCode_ReturnsFalse()
    {
        // Arrange
        string invalidCode = "123";

        // Act
        bool result = ValidationHelper.IsValidStationCode(invalidCode);

        // Assert
        Assert.IsFalse(result);
    }
}
```

### Integration Test

```csharp
[TestFixture]
public class BookingFlowIntegrationTests
{
    private IRCTCBookingOrchestrator orchestrator;

    [SetUp]
    public void Setup()
    {
        // Initialize with test credentials
        var licenseManager = new LicenseManager("TEST_LICENSE", "TEST_DEVICE");
        var captchaSolver = new CaptchaSolver("TEST_TOKEN");
        var authManager = new IRCTCAuthManager();
        
        // Load test credentials
        authManager.AccessToken = Environment.GetEnvironmentVariable("TEST_ACCESS_TOKEN");
        authManager.RefreshToken = Environment.GetEnvironmentVariable("TEST_REFRESH_TOKEN");
        
        orchestrator = new IRCTCBookingOrchestrator(
            licenseManager,
            captchaSolver,
            authManager
        );
    }

    [Test]
    [Category("Integration")]
    public async Task CompleteBookingFlow_ValidData_Success()
    {
        // Arrange
        var bookingData = new BookingRequestData
        {
            FromStation = "NDLS",
            ToStation = "BCT",
            JourneyClass = "3A",
            JourneyDate = DateTime.Now.AddDays(7).ToString("yyyyMMdd"),
            TrainNumber = "12301",
            MobileNumber = "9876543210",
            IRCTCUsername = "testuser",
            Passengers = new List<Passenger>
            {
                new Passenger
                {
                    passengerName = "TEST USER",
                    passengerAge = 30,
                    passengerGender = "M",
                    passengerNationality = "IN",
                    passengerSerialNumber = 1
                }
            },
            PaymentMethod = "EWALLET"
        };

        // Act
        var result = await orchestrator.ExecuteCompleteBookingAsync(bookingData);

        // Assert
        Assert.IsTrue(result.Success);
        Assert.IsNotNull(result.PNR);
        Assert.AreEqual(10, result.PNR.Length);
    }
}
```

### Debugging Tips

```csharp
public class DebugHelper
{
    public static void LogRequest(HttpRequestMessage request)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"=== REQUEST: {request.Method} {request.RequestUri} ===");
        sb.AppendLine("Headers:");
        foreach (var header in request.Headers)
        {
            sb.AppendLine($"  {header.Key}: {string.Join(", ", header.Value)}");
        }

        if (request.Content != null)
        {
            var content = request.Content.ReadAsStringAsync().Result;
            sb.AppendLine($"Body: {content}");
        }

        System.Diagnostics.Debug.WriteLine(sb.ToString());
    }

    public static void LogResponse(HttpResponseMessage response)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"=== RESPONSE: {(int)response.StatusCode} {response.StatusCode} ===");
        sb.AppendLine("Headers:");
        foreach (var header in response.Headers)
        {
            sb.AppendLine($"  {header.Key}: {string.Join(", ", header.Value)}");
        }

        var content = response.Content.ReadAsStringAsync().Result;
        sb.AppendLine($"Body: {content}");

        System.Diagnostics.Debug.WriteLine(sb.ToString());
    }
}

// Usage in HttpClient
public async Task<T> MakeRequestWithLoggingAsync<T>(HttpRequestMessage request)
{
    DebugHelper.LogRequest(request);
    
    var response = await httpClient.SendAsync(request);
    
    DebugHelper.LogResponse(response);
    
    return JsonConvert.DeserializeObject<T>(
        await response.Content.ReadAsStringAsync()
    );
}
```

---

## Deployment Guide

### Configuration File (appsettings.json)

```json
{
  "IRCTC": {
    "LicenseKey": "YOUR_LICENSE_KEY",
    "DeviceId": "YOUR_DEVICE_ID",
    "BookToken": "YOUR_BOOK_TOKEN",
    "BaseUrl": "https://www.irctc.co.in",
    "WPSUrl": "https://www.wps.irctc.co.in",
    "PaytmUrl": "https://secure.paytmpayments.com"
  },
  "Timeouts": {
    "HttpRequestTimeout": 30,
    "PaymentStatusPollInterval": 3,
    "PaymentMaxWaitMinutes": 5
  },
  "RateLimits": {
    "MaxRequestsPerMinute": 30,
    "RetryAttempts": 3,
    "RetryDelaySeconds": 2
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "IRCTC": "Debug"
    },
    "EnableRequestLogging": true,
    "EnableResponseLogging": true
  }
}
```

### Configuration Manager

```csharp
using Microsoft.Extensions.Configuration;

public class ConfigurationManager
{
    private readonly IConfiguration configuration;

    public ConfigurationManager()
    {
        configuration = new ConfigurationBuilder()
            .SetBasePath(AppDomain.CurrentDomain.BaseDirectory)
            .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
            .AddEnvironmentVariables()
            .Build();
    }

    public string LicenseKey => configuration["IRCTC:LicenseKey"];
    public string DeviceId => configuration["IRCTC:DeviceId"];
    public string BookToken => configuration["IRCTC:BookToken"];
    public int HttpTimeout => int.Parse(configuration["Timeouts:HttpRequestTimeout"]);
    public int MaxRequestsPerMinute => int.Parse(configuration["RateLimits:MaxRequestsPerMinute"]);
}
```

---

## Performance Optimization

### 1. Connection Pooling

```csharp
public class HttpClientFactory
{
    private static readonly Lazy<HttpClient> lazyClient = new Lazy<HttpClient>(() =>
    {
        var handler = new HttpClientHandler
        {
            MaxConnectionsPerServer = 10,
            UseCookies = true,
            CookieContainer = new CookieContainer(),
            AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate
        };

        var client = new HttpClient(handler)
        {
            Timeout = TimeSpan.FromSeconds(30)
        };

        // Set default headers
        client.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
        client.DefaultRequestHeaders.Add("Accept-Encoding", "gzip, deflate");

        return client;
    });

    public static HttpClient Client => lazyClient.Value;
}
```

### 2. Response Caching

```csharp
public class CacheManager
{
    private readonly MemoryCache cache;
    private readonly TimeSpan defaultExpiration = TimeSpan.FromMinutes(5);

    public CacheManager()
    {
        cache = new MemoryCache(new MemoryCacheOptions
        {
            SizeLimit = 100 // Limit to 100 entries
        });
    }

    public T Get<T>(string key)
    {
        return cache.TryGetValue(key, out T value) ? value : default;
    }

    public void Set<T>(string key, T value, TimeSpan? expiration = null)
    {
        var cacheOptions = new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = expiration ?? defaultExpiration,
            Size = 1
        };

        cache.Set(key, value, cacheOptions);
    }

    public void Remove(string key)
    {
        cache.Remove(key);
    }
}

// Usage in Train API
public async Task<List<TrainAvailability>> GetAlternativeTrainsWithCacheAsync(
    string from, string to, string cls, string date)
{
    string cacheKey = $"trains_{from}_{to}_{cls}_{date}";
    
    var cachedResult = cacheManager.Get<List<TrainAvailability>>(cacheKey);
    if (cachedResult != null)
    {
        System.Diagnostics.Debug.WriteLine("Returning cached train data");
        return cachedResult;
    }

    var trains = await GetAlternativeTrainsAsync(from, to, cls, date);
    
    // Cache for 2 minutes (train availability changes frequently)
    cacheManager.Set(cacheKey, trains, TimeSpan.FromMinutes(2));
    
    return trains;
}
```

### 3. Parallel API Calls

```csharp
public class ParallelBookingHelper
{
    public async Task<(FareEnquiryResponse fare, BoardingStationResponse boarding)> 
        GetFareAndBoardingInParallelAsync(
            string trainNo, string date, string from, string to, string cls)
    {
        var fareTask = trainAPI.GetAvailabilityAndFareAsync(trainNo, date, from, to, cls);
        var boardingTask = trainAPI.GetBoardingStationsAsync(trainNo, from, to, cls, date);

        await Task.WhenAll(fareTask, boardingTask);

        return (await fareTask, await boardingTask);
    }
}
```

---

## Common Issues & Solutions

### Issue 1: Token Expiration

**Problem**: Access token expires mid-booking

**Solution**: Implement proactive token refresh

```csharp
public class TokenRefreshMiddleware
{
    private readonly IRCTCAuthManager authManager;
    private readonly Timer refreshTimer;

    public TokenRefreshMiddleware(IRCTCAuthManager auth)
    {
        authManager = auth;
        
        // Refresh token every 20 minutes (before 30-min expiry)
        refreshTimer = new Timer(
            async _ => await RefreshTokenAsync(),
            null,
            TimeSpan.Zero,
            TimeSpan.FromMinutes(20)
        );
    }

    private async Task RefreshTokenAsync()
    {
        try
        {
            await authManager.ValidateAndRefreshTokenAsync();
            Console.WriteLine("Token refreshed successfully");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Token refresh failed: {ex.Message}");
        }
    }
}
```

### Issue 2: Captcha Failure

**Problem**: Captcha solving service returns incorrect result

**Solution**: Implement fallback mechanism

```csharp
public class CaptchaRetryHelper
{
    private readonly List<ICaptchaSolver> solvers;

    public CaptchaRetryHelper()
    {
        solvers = new List<ICaptchaSolver>
        {
            new PrimaryCaptchaSolver(),
            new SecondaryCaptchaSolver(),
            new ManualCaptchaSolver() // Last resort: manual input
        };
    }

    public async Task<string> SolveWithFallbackAsync(string captchaImage)
    {
        foreach (var solver in solvers)
        {
            try
            {
                var result = await solver.SolveAsync(captchaImage);
                if (!string.IsNullOrEmpty(result))
                {
                    return result;
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine(
                    $"Solver {solver.GetType().Name} failed: {ex.Message}"
                );
            }
        }

        throw new Exception("All captcha solvers failed");
    }
}
```

### Issue 3: Payment Timeout

**Problem**: Payment takes longer than expected

**Solution**: Implement extended polling with notifications

```csharp
public class PaymentStatusMonitor
{
    public event EventHandler<PaymentStatusEventArgs> StatusChanged;

    public async Task<PaymentResult> MonitorPaymentWithNotificationsAsync(
        PaytmUPIManager paytmManager,
        string transactionId,
        string cashierRequestId,
        int maxMinutes = 5)
    {
        int totalPolls = (maxMinutes * 60) / 3; // 3-second intervals
        int pollCount = 0;

        while (pollCount < totalPolls)
        {
            pollCount++;
            await Task.Delay(3000);

            try
            {
                var status = await paytmManager.PollTransactionStatusAsync(
                    transactionId,
                    cashierRequestId
                );

                // Notify listeners of status change
                StatusChanged?.Invoke(this, new PaymentStatusEventArgs
                {
                    Status = status.StatusMessage,
                    PercentComplete = (pollCount * 100) / totalPolls
                });

                if (status.IsFinal)
                {
                    return new PaymentResult
                    {
                        Success = status.IsSuccess,
                        TransactionId = transactionId,
                        Message = status.Message
                    };
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Poll failed: {ex.Message}");
            }
        }

        return new PaymentResult
        {
            Success = false,
            Message = "Payment timeout - please check manually"
        };
    }
}
```

### Issue 4: Network Failures

**Problem**: Intermittent network connectivity

**Solution**: Circuit breaker pattern

```csharp
public class CircuitBreaker
{
    private int failureCount = 0;
    private DateTime lastFailureTime = DateTime.MinValue;
    private readonly int failureThreshold;
    private readonly TimeSpan resetTimeout;
    private CircuitState state = CircuitState.Closed;

    public CircuitBreaker(int threshold = 5, int resetSeconds = 60)
    {
        failureThreshold = threshold;
        resetTimeout = TimeSpan.FromSeconds(resetSeconds);
    }

    public async Task<T> ExecuteAsync<T>(Func<Task<T>> operation)
    {
        if (state == CircuitState.Open)
        {
            if (DateTime.Now - lastFailureTime > resetTimeout)
            {
                state = CircuitState.HalfOpen;
            }
            else
            {
                throw new Exception("Circuit breaker is OPEN - service unavailable");
            }
        }

        try
        {
            var result = await operation();
            
            if (state == CircuitState.HalfOpen)
            {
                state = CircuitState.Closed;
                failureCount = 0;
            }

            return result;
        }
        catch (Exception ex)
        {
            failureCount++;
            lastFailureTime = DateTime.Now;

            if (failureCount >= failureThreshold)
            {
                state = CircuitState.Open;
                Console.WriteLine("Circuit breaker opened due to repeated failures");
            }

            throw;
        }
    }

    private enum CircuitState
    {
        Closed,
        Open,
        HalfOpen
    }
}
```

---

## Monitoring & Logging

### Structured Logging

```csharp
using Serilog;

public class LoggingSetup
{
    public static void ConfigureLogging()
    {
        Log.Logger = new LoggerConfiguration()
            .MinimumLevel.Debug()
            .WriteTo.Console()
            .WriteTo.File(
                "logs/irctc-.log",
                rollingInterval: RollingInterval.Day,
                retainedFileCountLimit: 7,
                outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] {Message:lj}{NewLine}{Exception}"
            )
            .CreateLogger();
    }
}

// Usage in booking flow
public async Task<BookingResult> BookWithLoggingAsync(BookingRequestData data)
{
    var correlationId = Guid.NewGuid().ToString();
    
    Log.Information(
        "Booking started. CorrelationId: {CorrelationId}, Train: {TrainNo}, Route: {From} -> {To}",
        correlationId,
        data.TrainNumber,
        data.FromStation,
        data.ToStation
    );

    try
    {
        var result = await ExecuteCompleteBookingAsync(data);
        
        Log.Information(
            "Booking completed. CorrelationId: {CorrelationId}, Success: {Success}, PNR: {PNR}",
            correlationId,
            result.Success,
            result.PNR
        );

        return result;
    }
    catch (Exception ex)
    {
        Log.Error(
            ex,
            "Booking failed. CorrelationId: {CorrelationId}",
            correlationId
        );
        throw;
    }
}
```

### Performance Monitoring

```csharp
public class PerformanceMonitor
{
    private readonly Stopwatch stopwatch = new Stopwatch();
    private readonly Dictionary<string, List<long>> metrics = new Dictionary<string, List<long>>();

    public void StartOperation(string operationName)
    {
        stopwatch.Restart();
        Console.WriteLine($"[{DateTime.Now:HH:mm:ss.fff}] Starting: {operationName}");
    }

    public void EndOperation(string operationName)
    {
        stopwatch.Stop();
        var elapsed = stopwatch.ElapsedMilliseconds;

        if (!metrics.ContainsKey(operationName))
        {
            metrics[operationName] = new List<long>();
        }
        metrics[operationName].Add(elapsed);

        Console.WriteLine($"[{DateTime.Now:HH:mm:ss.fff}] Completed: {operationName} ({elapsed}ms)");
    }

    public void PrintSummary()
    {
        Console.WriteLine("\n=== Performance Summary ===");
        foreach (var kvp in metrics)
        {
            var avg = kvp.Value.Average();
            var min = kvp.Value.Min();
            var max = kvp.Value.Max();

            Console.WriteLine($"{kvp.Key}:");
            Console.WriteLine($"  Average: {avg:F2}ms");
            Console.WriteLine($"  Min: {min}ms");
            Console.WriteLine($"  Max: {max}ms");
            Console.WriteLine($"  Count: {kvp.Value.Count}");
        }
    }
}

// Usage
var monitor = new PerformanceMonitor();

monitor.StartOperation("Train Search");
var trains = await trainAPI.GetAlternativeTrainsAsync(...);
monitor.EndOperation("Train Search");

monitor.StartOperation("Fare Check");
var fare = await trainAPI.GetAvailabilityAndFareAsync(...);
monitor.EndOperation("Fare Check");

monitor.PrintSummary();
```

---

## API Reference Quick Guide

### Quick Reference Table

| API | Method | Purpose | Retry? | Cache? |
|-----|--------|---------|--------|--------|
| validate | GET | Refresh tokens | Yes | No |
| altAvlEnq | POST | Search trains | Yes | 2 min |
| avlFarenquiry | POST | Check availability | Yes | 1 min |
| boardingStationEnq | POST | Get boarding stations | Yes | 5 min |
| allLapAvlFareEnq | POST | Submit passengers | No | No |
| addonServices | POST | Submit captcha | No | No |
| bookingInitPayment | POST | Initialize payment | No | No |
| PaymentRedirect | POST | Redirect to gateway | No | No |
| validateVpa | POST | Validate UPI ID | Yes | No |
| processTransaction | POST | Process payment | No | No |
| status (poll) | POST | Check payment status | Yes | No |
| bookingHistory | GET | Get PNR details | Yes | 30 sec |

### Common HTTP Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Process response |
| 400 | Bad Request | Check payload format |
| 401 | Unauthorized | Refresh tokens |
| 403 | Forbidden | Check CSRF token |
| 429 | Too Many Requests | Implement rate limiting |
| 500 | Server Error | Retry with backoff |
| 502/503 | Gateway/Service Unavailable | Retry after delay |

### Bank/Payment Method IDs

```csharp
public static class BankIds
{
    public const string EWALLET = "1000";
    public const string PAYTM = "78";
    public const string PAYU = "98";
    public const string RAZORPAY = "105";
    public const string PHONEPE = "116";
    public const string IRCTC_IPAY = "113";
}

public static class PaymentModes
{
    public const string NETBANKING = "1";
    public const string CARDS = "2";
    public const string EWALLET = "7";
    public const string IPAY = "9";
    public const string GATEWAY = "13";
}

public static class QuotaCodes
{
    public const string GENERAL = "GN";
    public const string TATKAL = "TQ";
    public const string LADIES = "LD";
    public const string SENIOR_CITIZEN = "SS";
    public const string PREMIUM_TATKAL = "PT";
}
```

---

## Appendix: Complete Example

### Full Working Example

```csharp
using System;
using System.Threading.Tasks;

namespace IRCTCBookingExample
{
    class Program
    {
        static async Task Main(string[] args)
        {
            try
            {
                Console.WriteLine("=== IRCTC Automated Booking System ===\n");

                // Step 1: Initialize managers
                var config = new ConfigurationManager();
                var licenseManager = new LicenseManager(config.LicenseKey, config.DeviceId);
                var captchaSolver = new CaptchaSolver(config.BookToken);
                
                var authManager = new IRCTCAuthManager();
                // Load tokens from secure storage
                authManager.AccessToken = SecureTokenStorage.DecryptToken(
                    Environment.GetEnvironmentVariable("IRCTC_ACCESS_TOKEN")
                );
                authManager.RefreshToken = SecureTokenStorage.DecryptToken(
                    Environment.GetEnvironmentVariable("IRCTC_REFRESH_TOKEN")
                );

                // Step 2: Create orchestrator
                var orchestrator = new IRCTCBookingOrchestrator(
                    licenseManager,
                    captchaSolver,
                    authManager
                );

                // Step 3: Prepare booking data
                var bookingData = new BookingRequestData
                {
                    FromStation = "NDLS",
                    ToStation = "BCT",
                    JourneyClass = "3A",
                    JourneyDate = DateTime.Now.AddDays(7).ToString("yyyyMMdd"),
                    TrainNumber = "12951",
                    MobileNumber = "9876543210",
                    IRCTCUsername = "your_username",
                    Passengers = new List<Passenger>
                    {
                        new Passenger
                        {
                            passengerName = "JOHN DOE",
                            passengerAge = 30,
                            passengerGender = "M",
                            passengerNationality = "IN",
                            passengerSerialNumber = 1,
                            passengerIcardFlag = false,
                            passengerCardType = "NULL_IDCARD",
                            passengerBerthChoice = "LB",
                            childBerthFlag = false
                        }
                    },
                    PaymentMethod = "PAYTM_UPI",
                    BankId = BankIds.PAYTM,
                    UPIAddress = "yourupi@paytm"
                };

                // Step 4: Execute booking
                Console.WriteLine("Starting booking process...\n");
                var result = await orchestrator.ExecuteCompleteBookingAsync(bookingData);

                // Step 5: Display result
                if (result.Success)
                {
                    Console.WriteLine("\n✅ BOOKING SUCCESSFUL!");
                    Console.WriteLine($"PNR: {result.PNR}");
                    Console.WriteLine($"Train: {result.BookingDetails.TrainNumber}");
                    Console.WriteLine($"Status: {result.BookingDetails.Status}");
                    Console.WriteLine($"Booking Date: {result.BookingDetails.BookingDate}");
                }
                else
                {
                    Console.WriteLine("\n❌ BOOKING FAILED!");
                    Console.WriteLine($"Reason: {result.Message}");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"\n💥 EXCEPTION: {ex.Message}");
                Console.WriteLine($"Stack Trace: {ex.StackTrace}");
            }

            Console.WriteLine("\nPress any key to exit...");
            Console.ReadKey();
        }
    }
}
```

---

## Support & Resources

### Official Documentation Links
- IRCTC API Documentation: Contact IRCTC for official docs
- Paytm Payment Gateway: https://developer.paytm.com/
- WebView2 Runtime: https://developer.microsoft.com/microsoft-edge/webview2/

### Troubleshooting Checklist

- [ ] License key is valid and active
- [ ] All authentication tokens are fresh (< 25 minutes old)
- [ ] Cookie container is properly configured
- [ ] All required headers are present
- [ ] Request payload matches expected format
- [ ] Station codes are valid (2-5 uppercase letters)
- [ ] Train number is 5 digits
- [ ] Date format is YYYYMMDD
- [ ] Mobile number is 10 digits starting with 6-9
- [ ] UPI address format is correct
- [ ] Network connectivity is stable
- [ ] Rate limiting is implemented
- [ ] Error handling and retries are in place

### Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "Invalid authentication" | Expired token | Refresh using validateUser API |
| "CSRF validation failed" | Missing/wrong CSRF | Extract from response headers |
| "Captcha incorrect" | Wrong captcha answer | Use better solver or manual input |
| "Train not available" | No seats | Try different class or date |
| "Payment timeout" | UPI not approved | Extend poll duration or check manually |
| "Booking already exists" | Duplicate request | Check transaction ID uniqueness |

---

## Version History

- **v1.0.0** (2025-01-15) - Initial documentation
  - Complete API integration guide
  - C# implementation examples
  - Security best practices
  - Performance optimization

---

## License & Disclaimer

**⚠️ IMPORTANT DISCLAIMER:**

This documentation is provided for educational purposes only. Users must:

1. Comply with IRCTC Terms of Service
2. Obtain proper API access permissions
3. Respect rate limits and fair usage policies
4. Ensure data privacy and security
5. Use automation responsibly

**The authors are not responsible for:**
- Misuse of the APIs
- Violations of IRCTC policies
- Financial losses
- Legal consequences

Always test in a non-production environment first.

---

**Document Version**: 1.0.0  
**Last Updated**: December 6, 2025  
**Created By**: Technical Documentation Team  
**Total Pages**: 45+  
**Code Examples**: 50+