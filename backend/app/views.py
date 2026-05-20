from django.http import HttpResponse


def hello(_request):
    return HttpResponse("Hello")
